/**
 * Generation Service
 *
 * Handles communication with the generation API:
 * - Job status polling
 * - Result retrieval
 * - Error handling
 */

export interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: GenerationResult;
  error?: {
    message: string;
    failedAt?: string;
  };
  completedAt?: string;
}

export interface CombatAttribute {
  attributeId: string;
  name: string;
  category: string;
  spriteAnimationId: string;
  damageType: string;
  attackType: string;
  priority: number;
  effectFrames?: string[];
}

export interface GenerationResult {
  inputType: 'text' | 'draw' | 'upload';
  textDescription?: string;
  originalImage?: string;
  claudeAnalysis?: {
    concept: string;
    race: string;
    class: string;
    abilities: string[];
    stats: {
      health: number;
      attack: number;
      defense: number;
      speed: number;
    };
  };
  animations?: {
    animationSet: {
      idle: string;
      walk: string;
      attack: string;
      death: string;
      additional: string[];
    };
    totalAnimations: number;
  };
  combatAttributes?: {
    attributes: CombatAttribute[];
    totalExtracted: number;
    confidence: number;
  };
  baselineAttackType?: 'melee' | 'ranged';
  styleValidation?: {
    passed: boolean;
    colorSimilarity: number;
    shapeSimilarity: number;
    overallScore: number;
    feedback: string;
  };
  spriteImageBase64?: string;
  animationFrames?: string[];
  generatedAt: string;
  processingTimeMs: number;
}

/**
 * Poll job status until completion or failure
 *
 * @param jobId - Job ID to poll
 * @param onProgress - Callback for progress updates
 * @param options - Polling configuration
 * @returns Final job status when complete/failed
 */
export async function pollJobStatus(
  jobId: string,
  onProgress?: (status: JobStatus) => void,
  options: {
    pollInterval?: number;
    maxAttempts?: number;
  } = {}
): Promise<JobStatus> {
  const pollInterval = options.pollInterval || 2000; // 2 seconds
  const maxAttempts = options.maxAttempts || 150; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const status = await getJobStatus(jobId);

      // Notify progress callback
      if (onProgress) {
        onProgress(status);
      }

      // Check if terminal state reached
      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }

      // Wait before next poll
      await delay(pollInterval);
    } catch (error) {
      console.error('[Generation Service] Polling error:', error);

      // If we've tried multiple times and keep failing, give up
      if (attempts > 3) {
        throw new Error('Failed to poll job status. Please try refreshing the page.');
      }

      // Otherwise, retry after delay
      await delay(pollInterval);
    }
  }

  throw new Error('Job status polling timed out. The generation may still be processing.');
}

/**
 * Get current status of a generation job
 *
 * @param jobId - Job ID to check
 * @returns Current job status
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`/api/generate/${jobId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Job not found. It may have been deleted or expired.');
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch job status');
  }

  const data = await response.json();
  return data as JobStatus;
}

/**
 * Delay helper for polling
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
