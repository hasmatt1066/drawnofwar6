/**
 * Abilities Catalog
 *
 * Central configuration for all game abilities used throughout the system.
 * This file serves as the single source of truth for:
 * 1. Claude Vision prompts (guides AI to use standardized ability IDs)
 * 2. Attribute mapping (maps natural language to combat attributes)
 * 3. Animation selection (links abilities to sprite animations)
 *
 * UPDATE MONTHLY: Add new abilities here as game content expands
 */

import type { CombatAttribute, AttributeCategory, DamageType, AttackType } from '../services/attributes/types.js';

/**
 * Complete ability definition with semantic keywords for matching
 */
export interface AbilityDefinition {
  id: string;                        // Unique identifier (e.g., "fire_breath")
  name: string;                      // Display name (e.g., "Fire Breath")
  keywords: string[];                // Natural language keywords for semantic matching
  category: AttributeCategory;       // Ability category
  damageType: DamageType;           // Type of damage
  attackType: AttackType;           // Attack classification
  priority: number;                 // Selection priority (1-10, higher = more important)
  spriteAnimationId: string;        // Animation ID from library
  power: number;                    // Power rating (1-10)
  range: number;                    // Range in hexes (0-6)
}

/**
 * Master abilities catalog
 * All abilities available in the game
 */
export const abilitiesCatalog: AbilityDefinition[] = [
  // ===== FIRE ABILITIES =====
  {
    id: 'fire_breath',
    name: 'Fire Breath',
    keywords: ['fire', 'breath', 'flame', 'breathe', 'dragon', 'flames', 'burning'],
    category: 'ability',
    damageType: 'fire',
    attackType: 'ranged',
    priority: 9,
    spriteAnimationId: 'breathe_fire',
    power: 9,      // AOE breath attack
    range: 4       // Medium range cone
  },
  {
    id: 'fire_spell',
    name: 'Fire Spell',
    keywords: ['fire', 'fireball', 'spell', 'magic', 'flame', 'pyro', 'blaze', 'inferno'],
    category: 'spell',
    damageType: 'fire',
    attackType: 'ranged',
    priority: 8,
    spriteAnimationId: 'cast_fire_spell',
    power: 7,      // Strong ranged spell
    range: 5       // Medium-long range
  },

  // ===== ICE ABILITIES =====
  {
    id: 'ice_breath',
    name: 'Ice Breath',
    keywords: ['ice', 'breath', 'frost', 'freeze', 'breathe', 'cold', 'frozen'],
    category: 'ability',
    damageType: 'ice',
    attackType: 'ranged',
    priority: 9,
    spriteAnimationId: 'breathe_ice',
    power: 9,      // AOE breath attack with CC
    range: 4       // Medium range cone
  },
  {
    id: 'ice_spell',
    name: 'Ice Spell',
    keywords: ['ice', 'frost', 'spell', 'magic', 'freeze', 'cold', 'blizzard', 'glacier'],
    category: 'spell',
    damageType: 'ice',
    attackType: 'ranged',
    priority: 8,
    spriteAnimationId: 'cast_ice_spell',
    power: 7,      // Strong ranged spell with CC
    range: 5       // Medium-long range
  },

  // ===== LIGHTNING ABILITIES =====
  {
    id: 'lightning_breath',
    name: 'Lightning Breath',
    keywords: ['lightning', 'breath', 'electric', 'thunder', 'breathe', 'shock', 'volt'],
    category: 'ability',
    damageType: 'lightning',
    attackType: 'ranged',
    priority: 9,
    spriteAnimationId: 'breathe_lightning',
    power: 9,      // AOE breath attack
    range: 4       // Medium range cone
  },
  {
    id: 'lightning_spell',
    name: 'Lightning Spell',
    keywords: ['lightning', 'thunder', 'spell', 'magic', 'electric', 'bolt', 'shock', 'storm'],
    category: 'spell',
    damageType: 'lightning',
    attackType: 'ranged',
    priority: 8,
    spriteAnimationId: 'cast_lightning_spell',
    power: 7,      // Strong ranged spell
    range: 5       // Medium-long range
  },

  // ===== MELEE ATTACKS =====
  {
    id: 'claw_strike',
    name: 'Claw Strike',
    keywords: ['claw', 'claws', 'strike', 'attack', 'swipe', 'slash', 'scratch', 'rake'],
    category: 'melee',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7,
    spriteAnimationId: 'attack_melee_claw',
    power: 6,      // High damage single-target
    range: 1       // Melee
  },
  {
    id: 'bite_attack',
    name: 'Bite Attack',
    keywords: ['bite', 'chomp', 'fangs', 'teeth', 'jaws', 'maw'],
    category: 'melee',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7,
    spriteAnimationId: 'attack_melee_bite',
    power: 7,      // Very high damage single-target
    range: 1       // Melee
  },
  {
    id: 'sword_strike',
    name: 'Sword Strike',
    keywords: ['sword', 'blade', 'slash', 'strike', 'cut', 'slice'],
    category: 'melee',
    damageType: 'physical',
    attackType: 'melee',
    priority: 6,
    spriteAnimationId: 'attack_melee_sword',
    power: 6,      // High damage single-target
    range: 1       // Melee
  },
  {
    id: 'axe_chop',
    name: 'Axe Chop',
    keywords: ['axe', 'chop', 'strike', 'cleave', 'hack'],
    category: 'melee',
    damageType: 'physical',
    attackType: 'melee',
    priority: 6,
    spriteAnimationId: 'attack_melee_axe',
    power: 8,      // Very high damage, slower
    range: 1       // Melee
  },

  // ===== RANGED ATTACKS =====
  {
    id: 'bow_shot',
    name: 'Bow Shot',
    keywords: ['bow', 'arrow', 'shot', 'shoot', 'archery', 'ranged'],
    category: 'ranged',
    damageType: 'physical',
    attackType: 'ranged',
    priority: 7,
    spriteAnimationId: 'attack_ranged_bow',
    power: 5,      // Moderate ranged damage
    range: 6       // Long range
  },
  {
    id: 'crossbow_shot',
    name: 'Crossbow Shot',
    keywords: ['crossbow', 'bolt', 'shot', 'shoot', 'ranged'],
    category: 'ranged',
    damageType: 'physical',
    attackType: 'ranged',
    priority: 7,
    spriteAnimationId: 'attack_ranged_crossbow',
    power: 6,      // High ranged damage
    range: 6       // Long range
  },
  {
    id: 'magic_missile',
    name: 'Magic Missile',
    keywords: ['magic', 'missile', 'projectile', 'ranged', 'spell', 'arcane'],
    category: 'spell',
    damageType: 'physical',
    attackType: 'ranged',
    priority: 7,
    spriteAnimationId: 'attack_ranged_magic',
    power: 6,      // High magic damage
    range: 5       // Medium-long range
  },

  // ===== SPECIAL ABILITIES =====
  {
    id: 'flight',
    name: 'Flight',
    keywords: ['flight', 'fly', 'flying', 'wings', 'aerial', 'airborne', 'hover'],
    category: 'ability',
    damageType: 'none',
    attackType: 'passive',
    priority: 5,
    spriteAnimationId: 'fly_default',
    power: 2,      // Passive utility
    range: 0       // Self
  },
  {
    id: 'wing_attack',
    name: 'Wing Attack',
    keywords: ['wing', 'wings', 'attack', 'buffet', 'gust'],
    category: 'melee',
    damageType: 'physical',
    attackType: 'melee',
    priority: 8,
    spriteAnimationId: 'wing_attack',
    power: 8,      // AOE knockback
    range: 2       // Short range AOE
  },
  {
    id: 'tail_whip',
    name: 'Tail Whip',
    keywords: ['tail', 'whip', 'sweep', 'swipe', 'lash'],
    category: 'melee',
    damageType: 'physical',
    attackType: 'melee',
    priority: 8,
    spriteAnimationId: 'tail_whip',
    power: 7,      // AOE sweep
    range: 2       // Short range AOE
  },
  {
    id: 'roar',
    name: 'Roar',
    keywords: ['roar', 'shout', 'bellow', 'cry', 'intimidate', 'battle'],
    category: 'ability',
    damageType: 'none',
    attackType: 'debuff',
    priority: 6,
    spriteAnimationId: 'roar',
    power: 5,      // Debuff AOE
    range: 3       // Short-medium range AOE
  },
  {
    id: 'stomp',
    name: 'Stomp',
    keywords: ['stomp', 'slam', 'ground', 'pound', 'quake', 'earthquake'],
    category: 'melee',
    damageType: 'physical',
    attackType: 'aoe',
    priority: 7,
    spriteAnimationId: 'stomp',
    power: 9,      // High AOE damage
    range: 2       // Short range AOE
  },
  {
    id: 'charge',
    name: 'Charge',
    keywords: ['charge', 'rush', 'ram', 'tackle', 'bull'],
    category: 'melee',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7,
    spriteAnimationId: 'charge_attack',
    power: 7,      // High damage with movement
    range: 1       // Melee (with gap closer)
  },

  // ===== DEFENSIVE ABILITIES =====
  {
    id: 'shield_block',
    name: 'Shield Block',
    keywords: ['shield', 'block', 'defend', 'defense', 'guard', 'protect'],
    category: 'defense',
    damageType: 'none',
    attackType: 'passive',
    priority: 5,
    spriteAnimationId: 'defend_shield',
    power: 3,      // Passive defense
    range: 0       // Self
  },
  {
    id: 'parry',
    name: 'Parry',
    keywords: ['parry', 'deflect', 'riposte', 'counter', 'block'],
    category: 'defense',
    damageType: 'none',
    attackType: 'passive',
    priority: 5,
    spriteAnimationId: 'parry_default',
    power: 3,      // Passive defense
    range: 0       // Self
  },
  {
    id: 'counter',
    name: 'Counter Attack',
    keywords: ['counter', 'counterattack', 'riposte', 'retaliate', 'revenge'],
    category: 'defense',
    damageType: 'physical',
    attackType: 'melee',
    priority: 6,
    spriteAnimationId: 'counter_attack',
    power: 6,      // Reactive damage
    range: 1       // Melee counter
  },

  // ===== HEALING & BUFFS =====
  {
    id: 'heal',
    name: 'Heal',
    keywords: ['heal', 'healing', 'restore', 'recovery', 'cure', 'mend', 'holy'],
    category: 'spell',
    damageType: 'holy',
    attackType: 'buff',
    priority: 6,
    spriteAnimationId: 'heal_spell',
    power: 6,      // Significant healing
    range: 3       // Short-medium range
  },
  {
    id: 'buff',
    name: 'Buff',
    keywords: ['buff', 'enhance', 'boost', 'strengthen', 'empower', 'augment'],
    category: 'spell',
    damageType: 'none',
    attackType: 'buff',
    priority: 5,
    spriteAnimationId: 'buff_spell',
    power: 4,      // Utility buff
    range: 3       // Short-medium range
  },

  // ===== POISON & DARK =====
  {
    id: 'poison_spit',
    name: 'Poison Spit',
    keywords: ['poison', 'spit', 'venom', 'toxic', 'spray', 'acid'],
    category: 'ranged',
    damageType: 'poison',
    attackType: 'ranged',
    priority: 8,
    spriteAnimationId: 'spit_poison',
    power: 7,      // High DOT damage
    range: 4       // Medium range
  },
  {
    id: 'web_shot',
    name: 'Web Shot',
    keywords: ['web', 'webbing', 'spider', 'trap', 'ensnare', 'net'],
    category: 'ranged',
    damageType: 'none',
    attackType: 'debuff',
    priority: 7,
    spriteAnimationId: 'web_shot',
    power: 5,      // CC utility
    range: 4       // Medium range
  },
  {
    id: 'dark_spell',
    name: 'Dark Spell',
    keywords: ['dark', 'shadow', 'curse', 'spell', 'magic', 'void', 'necromancy'],
    category: 'spell',
    damageType: 'dark',
    attackType: 'ranged',
    priority: 8,
    spriteAnimationId: 'cast_dark_spell',
    power: 7,      // Strong dark magic
    range: 5       // Medium-long range
  },

  // ===== MOVEMENT ABILITIES =====
  {
    id: 'dash',
    name: 'Dash',
    keywords: ['dash', 'sprint', 'rush', 'quick', 'speed'],
    category: 'ability',
    damageType: 'none',
    attackType: 'passive',
    priority: 4,
    spriteAnimationId: 'dash_default',
    power: 2,      // Utility movement
    range: 0       // Self (moves character)
  },
  {
    id: 'teleport',
    name: 'Teleport',
    keywords: ['teleport', 'blink', 'warp', 'phase', 'shift', 'portal'],
    category: 'spell',
    damageType: 'none',
    attackType: 'passive',
    priority: 6,
    spriteAnimationId: 'teleport',
    power: 4,      // Strong utility
    range: 0       // Self (repositions character)
  },
  {
    id: 'stealth',
    name: 'Stealth',
    keywords: ['stealth', 'invisible', 'hide', 'sneak', 'camouflage', 'vanish'],
    category: 'ability',
    damageType: 'none',
    attackType: 'passive',
    priority: 5,
    spriteAnimationId: 'stealth',
    power: 3,      // Utility stealth
    range: 0       // Self
  }
];

/**
 * Build formatted ability guidance for Claude's prompt
 * Groups abilities by category for easy reference
 *
 * @returns Formatted string for inclusion in Claude prompt
 */
export function buildClaudeAbilityGuidance(): string {
  const grouped = new Map<AttributeCategory, AbilityDefinition[]>();

  // Group by category
  for (const ability of abilitiesCatalog) {
    if (!grouped.has(ability.category)) {
      grouped.set(ability.category, []);
    }
    grouped.get(ability.category)!.push(ability);
  }

  // Build formatted output
  let output = 'Use ONLY these standardized ability IDs (choose 2-5 that match creature features):\n';

  const categoryOrder: AttributeCategory[] = ['melee', 'ranged', 'spell', 'ability', 'defense'];

  for (const category of categoryOrder) {
    const abilities = grouped.get(category);
    if (!abilities || abilities.length === 0) continue;

    output += `\n${category.toUpperCase()}:\n`;
    for (const ability of abilities) {
      output += `  - "${ability.id}" (${ability.name}) - ${ability.keywords.slice(0, 3).join(', ')}\n`;
    }
  }

  output += '\nExamples:\n';
  output += '  - Fire dragon: ["fire_breath", "claw_strike", "flight", "tail_whip"]\n';
  output += '  - Archer warrior: ["bow_shot", "sword_strike", "dash"]\n';
  output += '  - Ice mage: ["ice_spell", "teleport", "shield_block"]\n';

  return output;
}

/**
 * Find ability by keyword matching
 * Returns best match based on keyword overlap
 *
 * @param naturalLanguage - Natural language ability description
 * @returns Best matching ability or null
 */
export function findAbilityByKeywords(naturalLanguage: string): AbilityDefinition | null {
  const normalized = naturalLanguage.toLowerCase().trim();
  const words = normalized.split(/[\s_-]+/);

  let bestMatch: AbilityDefinition | null = null;
  let bestScore = 0;

  for (const ability of abilitiesCatalog) {
    // Check for exact ID match first
    if (ability.id === normalized || ability.id.replace(/_/g, ' ') === normalized) {
      return ability;
    }

    // Calculate keyword overlap score
    let score = 0;
    for (const keyword of ability.keywords) {
      for (const word of words) {
        if (keyword.includes(word) || word.includes(keyword)) {
          score++;
        }
      }
    }

    // Update best match
    if (score > bestScore) {
      bestScore = score;
      bestMatch = ability;
    }
  }

  // Only return if we have reasonable confidence (at least 1 keyword match)
  return bestScore > 0 ? bestMatch : null;
}

/**
 * Convert ability definition to combat attribute
 *
 * @param ability - Ability definition
 * @returns Combat attribute
 */
export function abilityToAttribute(ability: AbilityDefinition): CombatAttribute {
  return {
    attributeId: ability.id,
    name: ability.name,
    category: ability.category,
    spriteAnimationId: ability.spriteAnimationId,
    damageType: ability.damageType,
    attackType: ability.attackType,
    priority: ability.priority
  };
}
