/**
 * Claude Vision Service
 *
 * Analyzes creature images using Claude Vision API to extract game attributes.
 * Handles prompt engineering, API calls, response parsing, and error recovery.
 */

import dotenv from 'dotenv';

// Load environment variables before initializing service
dotenv.config();

import Anthropic from '@anthropic-ai/sdk';
import { getClaudeConfig } from '../../config/claude.config.js';
import type { ClaudeAnalysisResult, ClaudeVisionRequest, ClaudeCostMetrics } from './types.js';
import {
  buildCreatureAnalysisPrompt,
  parseClaudeResponse,
  validateClaudeResponse
} from './prompts.js';
import {
  createClaudeError,
  getDefaultFallback,
  withRetry
} from './error-handler.js';

/**
 * Claude Vision Service
 * Singleton service for analyzing creature images
 */
class ClaudeVisionService {
  private client: Anthropic;
  private config: ReturnType<typeof getClaudeConfig>;
  private costMetrics: ClaudeCostMetrics[] = [];

  constructor() {
    this.config = getClaudeConfig();
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      timeout: this.config.timeoutMs
    });

    console.log('[Claude Vision] Service initialized');
    console.log(`[Claude Vision] Model: ${this.config.model}`);
  }

  /**
   * Analyze a creature image and extract game attributes
   *
   * @param request - Image and optional text context
   * @returns Structured creature attributes
   * @throws ClaudeVisionError on failure (includes fallback)
   */
  async analyzeCreature(request: ClaudeVisionRequest): Promise<ClaudeAnalysisResult> {
    const startTime = Date.now();

    console.log('[Claude Vision] Starting creature analysis...');
    if (request.textContext) {
      console.log(`[Claude Vision] Text context: "${request.textContext}"`);
    }

    try {
      // Build prompt
      const prompt = buildCreatureAnalysisPrompt(request.textContext);

      // Call Claude Vision API with retry logic
      const response = await withRetry(async () => {
        return await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: request.image.format === 'png' ? 'image/png' : 'image/jpeg',
                    data: request.image.base64
                  }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ]
        });
      }, 3); // Max 3 attempts

      // Extract text from response
      const responseText = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      console.log('[Claude Vision] Received response from API');

      // Parse JSON response
      const parsed = parseClaudeResponse(responseText);

      // Validate response structure
      validateClaudeResponse(parsed);

      // Build result
      const result: ClaudeAnalysisResult = {
        concept: parsed.concept,
        race: parsed.race,
        class: parsed.class,
        primaryAttributes: {
          hp: this.clampValue(parsed.primaryAttributes.hp, 10, 200),
          attack: this.clampValue(parsed.primaryAttributes.attack, 1, 50),
          defense: this.clampValue(parsed.primaryAttributes.defense, 0, 30),
          speed: this.clampValue(parsed.primaryAttributes.speed, 1, 10)
        },
        abilities: parsed.abilities.slice(0, 10), // Max 10 abilities
        suggestedAnimations: parsed.suggestedAnimations.slice(0, 30), // Max 30 animations
        styleCharacteristics: {
          dominantColors: this.validateColors(parsed.styleCharacteristics.dominantColors),
          shapeComplexity: this.validateComplexity(parsed.styleCharacteristics.shapeComplexity),
          artStyle: parsed.styleCharacteristics.artStyle || 'sketch'
        },
        confidence: parsed.confidence || 0.8,
        tokenUsage: response.usage.input_tokens + response.usage.output_tokens
      };

      // Track cost
      await this.trackCost({
        timestamp: new Date(),
        tokensUsed: result.tokenUsage,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: this.calculateCost(response.usage.input_tokens, response.usage.output_tokens),
        model: this.config.model,
        requestDurationMs: Date.now() - startTime
      });

      console.log('[Claude Vision] Analysis complete');
      console.log(`[Claude Vision] Concept: "${result.concept}"`);
      console.log(`[Claude Vision] Race: ${result.race}, Class: ${result.class}`);
      console.log(`[Claude Vision] Animations: ${result.suggestedAnimations.length}`);
      console.log(`[Claude Vision] Tokens used: ${result.tokenUsage}`);
      console.log(`[Claude Vision] Duration: ${Date.now() - startTime}ms`);

      return result;
    } catch (error: any) {
      console.error('[Claude Vision] Analysis failed:', error.message);

      // Create error with fallback
      const claudeError = createClaudeError(error, getDefaultFallback());

      // If we have a fallback, use it
      if (claudeError.fallback) {
        console.warn('[Claude Vision] Using fallback attributes');
        return claudeError.fallback;
      }

      // Otherwise, throw the error
      throw claudeError;
    }
  }

  /**
   * Clamp numeric value to valid range
   */
  private clampValue(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  /**
   * Validate and sanitize color array
   */
  private validateColors(colors: string[]): string[] {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const validated = colors.filter(color => hexPattern.test(color));

    // Ensure at least 3 colors
    if (validated.length < 3) {
      return ['#808080', '#404040', '#C0C0C0', '#000000', '#FFFFFF'];
    }

    // Limit to 8 colors
    return validated.slice(0, 8);
  }

  /**
   * Validate shape complexity
   */
  private validateComplexity(complexity: string): 'simple' | 'moderate' | 'complex' {
    if (complexity === 'simple' || complexity === 'moderate' || complexity === 'complex') {
      return complexity;
    }
    return 'moderate';
  }

  /**
   * Calculate cost in USD based on token usage
   * Pricing as of 2024 (update if changed):
   * - Claude 3.5 Sonnet: $3/MTok input, $15/MTok output
   * - Claude 3 Sonnet: $3/MTok input, $15/MTok output
   * - Claude 3 Haiku: $0.25/MTok input, $1.25/MTok output
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    // Default to Sonnet pricing
    let inputCostPerMTok = 3.0;
    let outputCostPerMTok = 15.0;

    // Adjust for different models
    if (this.config.model.includes('haiku')) {
      inputCostPerMTok = 0.25;
      outputCostPerMTok = 1.25;
    } else if (this.config.model.includes('opus')) {
      inputCostPerMTok = 15.0;
      outputCostPerMTok = 75.0;
    }

    const inputCost = (inputTokens / 1_000_000) * inputCostPerMTok;
    const outputCost = (outputTokens / 1_000_000) * outputCostPerMTok;

    return inputCost + outputCost;
  }

  /**
   * Track API cost metrics
   */
  private async trackCost(metrics: ClaudeCostMetrics): Promise<void> {
    this.costMetrics.push(metrics);

    console.log(`[Claude Vision] Cost: $${metrics.costUsd.toFixed(6)}`);

    // Keep only last 1000 metrics in memory
    if (this.costMetrics.length > 1000) {
      this.costMetrics = this.costMetrics.slice(-1000);
    }

    // TODO: Send to metrics service (Prometheus, CloudWatch, etc.)
  }

  /**
   * Get cost statistics
   */
  getCostStats(sinceDays: number = 1): {
    totalCost: number;
    totalTokens: number;
    requestCount: number;
    avgCostPerRequest: number;
    avgDuration: number;
  } {
    const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const recent = this.costMetrics.filter(m => m.timestamp >= cutoff);

    if (recent.length === 0) {
      return {
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        avgCostPerRequest: 0,
        avgDuration: 0
      };
    }

    const totalCost = recent.reduce((sum, m) => sum + m.costUsd, 0);
    const totalTokens = recent.reduce((sum, m) => sum + m.tokensUsed, 0);
    const avgDuration = recent.reduce((sum, m) => sum + m.requestDurationMs, 0) / recent.length;

    return {
      totalCost,
      totalTokens,
      requestCount: recent.length,
      avgCostPerRequest: totalCost / recent.length,
      avgDuration
    };
  }
}

// Export singleton instance
export const claudeVisionService = new ClaudeVisionService();
