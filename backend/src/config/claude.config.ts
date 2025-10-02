/**
 * Claude API Configuration
 *
 * Configures Anthropic Claude Vision API for creature analysis.
 * Loads from environment variables with validation.
 */

export interface ClaudeConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
}

/**
 * Load and validate Claude configuration from environment variables
 */
export function loadClaudeConfig(): ClaudeConfig {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  const apiUrl = process.env['ANTHROPIC_API_URL'] || 'https://api.anthropic.com/v1';
  const model = process.env['ANTHROPIC_MODEL'] || 'claude-3-sonnet-20240229';
  const maxTokens = parseInt(process.env['ANTHROPIC_MAX_TOKENS'] || '1024', 10);
  const timeoutMs = parseInt(process.env['ANTHROPIC_TIMEOUT_MS'] || '30000', 10);

  // Validate required fields
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set in environment variables. ' +
      'Please add your Anthropic API key to the .env file. ' +
      'See API_KEYS_SETUP.md for instructions.'
    );
  }

  // Validate API key format
  if (!apiKey.startsWith('sk-ant-')) {
    throw new Error(
      'Invalid ANTHROPIC_API_KEY format. ' +
      'Anthropic API keys should start with "sk-ant-". ' +
      'Please check your .env file.'
    );
  }

  // Validate model
  const validModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ];

  if (!validModels.includes(model)) {
    console.warn(
      `Warning: Unknown Claude model "${model}". ` +
      `Valid models: ${validModels.join(', ')}`
    );
  }

  return {
    apiKey,
    apiUrl,
    model,
    maxTokens,
    timeoutMs
  };
}

/**
 * Get Claude configuration (singleton)
 */
let cachedConfig: ClaudeConfig | null = null;

export function getClaudeConfig(): ClaudeConfig {
  if (!cachedConfig) {
    cachedConfig = loadClaudeConfig();
  }
  return cachedConfig;
}

/**
 * Validate Claude configuration on startup
 */
export function validateClaudeConfig(): void {
  try {
    const config = getClaudeConfig();
    console.log('[Claude Config] Configuration loaded successfully');
    console.log(`[Claude Config] Model: ${config.model}`);
    console.log(`[Claude Config] API URL: ${config.apiUrl}`);
    console.log(`[Claude Config] Max Tokens: ${config.maxTokens}`);
    console.log(`[Claude Config] Timeout: ${config.timeoutMs}ms`);
  } catch (error) {
    console.error('[Claude Config] Configuration validation failed:', error);
    throw error;
  }
}
