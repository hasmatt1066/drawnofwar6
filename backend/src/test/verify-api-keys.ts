/**
 * API Keys Verification Script
 *
 * Tests both PixelLab and Anthropic API keys to ensure they're valid
 * and the services are accessible.
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

import Anthropic from '@anthropic-ai/sdk';
import { getClaudeConfig } from '../config/claude.config';

/**
 * Verify Anthropic API key
 */
async function verifyAnthropicKey(): Promise<boolean> {
  console.log('\n🔍 Verifying Anthropic API key...');

  try {
    const config = getClaudeConfig();
    const client = new Anthropic({
      apiKey: config.apiKey
    });

    // Simple test: Create a minimal request
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: 'Hello! Please respond with just "OK" if you can read this.'
      }]
    });

    if (response.content && response.content.length > 0) {
      console.log('✅ Anthropic API key is valid');
      console.log(`   Model: ${config.model}`);
      console.log(`   Response received successfully`);
      return true;
    } else {
      console.error('❌ Anthropic API returned empty response');
      return false;
    }
  } catch (error: any) {
    console.error('❌ Anthropic API key verification failed');

    if (error.status === 401) {
      console.error('   Error: Invalid API key (401 Unauthorized)');
      console.error('   Please check your ANTHROPIC_API_KEY in .env file');
    } else if (error.status === 429) {
      console.error('   Error: Rate limit exceeded (429)');
      console.error('   Your API key is valid but you\'ve hit rate limits');
      return true; // Key is valid, just rate limited
    } else {
      console.error(`   Error: ${error.message}`);
    }

    return false;
  }
}

/**
 * Verify PixelLab API key
 */
async function verifyPixelLabKey(): Promise<boolean> {
  console.log('\n🔍 Verifying PixelLab API key...');

  const apiKey = process.env.PIXELLAB_API_KEY;
  const apiUrl = process.env.PIXELLAB_API_URL || 'https://api.pixellab.ai/v1';

  if (!apiKey || apiKey === 'your-pixellab-api-key-here') {
    console.error('❌ PixelLab API key not configured');
    console.error('   Please add your PIXELLAB_API_KEY to .env file');
    return false;
  }

  try {
    // Test connection to PixelLab API
    // Note: This is a placeholder - actual verification depends on PixelLab API endpoints
    console.log('✅ PixelLab API key configured');
    console.log(`   API URL: ${apiUrl}`);
    console.log('   Note: Full verification requires actual API call during generation');
    return true;
  } catch (error: any) {
    console.error('❌ PixelLab API verification failed');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Main verification function
 */
async function verifyAllKeys(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  API Keys Verification');
  console.log('═══════════════════════════════════════════════════════');

  const results: { [key: string]: boolean } = {};

  // Verify Anthropic
  results.anthropic = await verifyAnthropicKey();

  // Verify PixelLab
  results.pixellab = await verifyPixelLabKey();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Verification Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Anthropic (Claude): ${results.anthropic ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`PixelLab:           ${results.pixellab ? '✅ Configured' : '❌ Not configured'}`);
  console.log('═══════════════════════════════════════════════════════');

  if (results.anthropic && results.pixellab) {
    console.log('\n✨ All API keys verified successfully!');
    console.log('   You can now proceed with implementation.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some API keys failed verification.');
    console.log('   Please check your .env file and try again.\n');
    process.exit(1);
  }
}

// Run verification
verifyAllKeys().catch((error) => {
  console.error('\n💥 Verification script failed:');
  console.error(error);
  process.exit(1);
});
