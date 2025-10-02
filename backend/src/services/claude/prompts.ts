/**
 * Claude Vision Prompts
 *
 * Carefully crafted prompts for extracting game attributes from creature images.
 * Uses structured output format to ensure consistent responses.
 */

/**
 * Build prompt for creature analysis
 * Uses few-shot examples and clear instructions for consistent JSON output
 */
export function buildCreatureAnalysisPrompt(textContext?: string): string {
  const contextSection = textContext
    ? `\nUser's description: "${textContext}"\nUse this description to inform your analysis, but rely primarily on what you see in the image.`
    : '';

  return `You are analyzing a user's drawing of a game creature for a tactical RPG. Your job is to extract game attributes from the visual design.

${contextSection}

Analyze this creature image and extract the following information:

1. **Concept**: A brief 2-5 word description of the creature (e.g., "fierce fire dragon", "armored knight warrior")

2. **Race**: The creature's species/type (e.g., "dragon", "human", "orc", "demon", "beast", "undead", "elemental")

3. **Class**: The creature's role/archetype (e.g., "warrior", "mage", "rogue", "tank", "support", "ranged")

4. **Primary Attributes**: Assign balanced stats based on visual appearance:
   - HP (Health): 10-200 (size, armor, bulk)
   - Attack: 1-50 (weapons, claws, visible power)
   - Defense: 0-30 (armor, shields, protective features)
   - Speed: 1-10 (body type, wings, sleek design)

5. **Abilities**: Identify 2-5 abilities this creature likely has based on visual features:
   - Physical abilities: "melee_attack", "charge", "claw_strike", "bite"
   - Ranged abilities: "ranged_attack", "projectile", "throw"
   - Magic abilities: "fire_spell", "ice_spell", "lightning", "heal"
   - Special abilities: "flight", "fire_breath", "poison", "teleport", "shield"

6. **Suggested Animations**: Based on the creature type and abilities, suggest 15-25 animations:
   - Base: "idle", "walk", "run", "death"
   - Combat: "attack_melee", "attack_ranged", "defend", "dodge", "hit"
   - Abilities: Match to identified abilities (e.g., "cast_fire_spell", "breathe_fire", "fly")
   - Reactions: "celebrate", "taunt", "scared", "hurt"

7. **Style Characteristics**:
   - Dominant Colors: Extract 5-8 main hex colors from the image
   - Shape Complexity: "simple" (basic shapes), "moderate" (some detail), "complex" (highly detailed)
   - Art Style: Describe the drawing style (e.g., "cartoon", "realistic", "pixelated", "sketch", "manga")

**Important Guidelines**:
- If the drawing is abstract or unclear, make reasonable assumptions
- Balance stats so total = 100-150 points (HP counts as points/10)
- Prioritize abilities that match visible features
- Be creative but grounded in what you actually see
- Always suggest at least 15 animations (preferably 20-25)

**Response Format** (JSON only, no other text):
\`\`\`json
{
  "concept": "fierce fire dragon",
  "race": "dragon",
  "class": "warrior",
  "primaryAttributes": {
    "hp": 150,
    "attack": 40,
    "defense": 20,
    "speed": 6
  },
  "abilities": ["flight", "fire_breath", "claw_strike", "tail_whip"],
  "suggestedAnimations": ["idle", "walk", "run", "fly", "attack_melee", "attack_claw", "breathe_fire", "roar", "land", "takeoff", "glide", "hit", "death", "celebrate", "intimidate", "bite", "tail_swipe", "wing_flap", "circle", "dive_attack"],
  "styleCharacteristics": {
    "dominantColors": ["#FF0000", "#8B0000", "#FFA500", "#000000", "#808080"],
    "shapeComplexity": "moderate",
    "artStyle": "cartoon"
  },
  "confidence": 0.85
}
\`\`\`

Now analyze the provided image and respond with ONLY the JSON object (no other text before or after).`;
}

/**
 * Parse Claude's response and extract JSON
 * Handles both pure JSON and JSON wrapped in markdown code blocks
 */
export function parseClaudeResponse(responseText: string): any {
  // Remove markdown code blocks if present
  let cleaned = responseText.trim();

  // Check for code block wrapper
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Parse JSON
  try {
    return JSON.parse(cleaned);
  } catch (error: any) {
    throw new Error(`Failed to parse Claude response as JSON: ${error.message}\n\nResponse: ${responseText.substring(0, 200)}...`);
  }
}

/**
 * Validate parsed response has all required fields
 */
export function validateClaudeResponse(parsed: any): void {
  const required = [
    'concept',
    'race',
    'class',
    'primaryAttributes',
    'abilities',
    'suggestedAnimations',
    'styleCharacteristics'
  ];

  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field in Claude response: ${field}`);
    }
  }

  // Validate nested fields
  if (!parsed.primaryAttributes.hp || !parsed.primaryAttributes.attack ||
      !parsed.primaryAttributes.defense || !parsed.primaryAttributes.speed) {
    throw new Error('Missing required primaryAttributes fields');
  }

  if (!parsed.styleCharacteristics.dominantColors ||
      !parsed.styleCharacteristics.shapeComplexity ||
      !parsed.styleCharacteristics.artStyle) {
    throw new Error('Missing required styleCharacteristics fields');
  }

  // Validate arrays
  if (!Array.isArray(parsed.abilities) || parsed.abilities.length === 0) {
    throw new Error('abilities must be a non-empty array');
  }

  if (!Array.isArray(parsed.suggestedAnimations) || parsed.suggestedAnimations.length < 10) {
    throw new Error('suggestedAnimations must have at least 10 animations');
  }

  if (!Array.isArray(parsed.styleCharacteristics.dominantColors) ||
      parsed.styleCharacteristics.dominantColors.length < 3) {
    throw new Error('dominantColors must have at least 3 colors');
  }
}
