/**
 * Attribute Mapping Configuration
 *
 * Maps ability strings (from Claude) to combat attributes with sprite animations.
 * This configuration links abilities → attribute definitions → animation IDs.
 */

import type { CombatAttribute } from './types.js';

/**
 * Attribute mapping configuration
 * Key = ability string from Claude
 * Value = Combat attribute definition
 */
export const attributeMap: Record<string, CombatAttribute> = {
  // ===== FIRE ABILITIES =====
  'fire_breath': {
    attributeId: 'fire_breath',
    name: 'Fire Breath',
    category: 'ability',
    spriteAnimationId: 'breathe_fire',
    damageType: 'fire',
    attackType: 'ranged',
    priority: 9
  },
  'flame_breath': {
    attributeId: 'fire_breath',
    name: 'Fire Breath',
    category: 'ability',
    spriteAnimationId: 'breathe_fire',
    damageType: 'fire',
    attackType: 'ranged',
    priority: 9
  },
  'fire_spell': {
    attributeId: 'fire_spell',
    name: 'Fire Spell',
    category: 'spell',
    spriteAnimationId: 'cast_fire_spell',
    damageType: 'fire',
    attackType: 'ranged',
    priority: 8
  },
  'fireball': {
    attributeId: 'fire_spell',
    name: 'Fire Spell',
    category: 'spell',
    spriteAnimationId: 'cast_fire_spell',
    damageType: 'fire',
    attackType: 'ranged',
    priority: 8
  },

  // ===== ICE ABILITIES =====
  'ice_breath': {
    attributeId: 'ice_breath',
    name: 'Ice Breath',
    category: 'ability',
    spriteAnimationId: 'breathe_ice',
    damageType: 'ice',
    attackType: 'ranged',
    priority: 9
  },
  'frost_breath': {
    attributeId: 'ice_breath',
    name: 'Ice Breath',
    category: 'ability',
    spriteAnimationId: 'breathe_ice',
    damageType: 'ice',
    attackType: 'ranged',
    priority: 9
  },
  'ice_spell': {
    attributeId: 'ice_spell',
    name: 'Ice Spell',
    category: 'spell',
    spriteAnimationId: 'cast_ice_spell',
    damageType: 'ice',
    attackType: 'ranged',
    priority: 8
  },
  'frost_spell': {
    attributeId: 'ice_spell',
    name: 'Ice Spell',
    category: 'spell',
    spriteAnimationId: 'cast_ice_spell',
    damageType: 'ice',
    attackType: 'ranged',
    priority: 8
  },

  // ===== LIGHTNING ABILITIES =====
  'lightning_breath': {
    attributeId: 'lightning_breath',
    name: 'Lightning Breath',
    category: 'ability',
    spriteAnimationId: 'breathe_lightning',
    damageType: 'lightning',
    attackType: 'ranged',
    priority: 9
  },
  'lightning_spell': {
    attributeId: 'lightning_spell',
    name: 'Lightning Spell',
    category: 'spell',
    spriteAnimationId: 'cast_lightning_spell',
    damageType: 'lightning',
    attackType: 'ranged',
    priority: 8
  },
  'thunder_spell': {
    attributeId: 'lightning_spell',
    name: 'Lightning Spell',
    category: 'spell',
    spriteAnimationId: 'cast_lightning_spell',
    damageType: 'lightning',
    attackType: 'ranged',
    priority: 8
  },

  // ===== MELEE ATTACKS =====
  'claw_strike': {
    attributeId: 'claw_strike',
    name: 'Claw Strike',
    category: 'melee',
    spriteAnimationId: 'attack_melee_claw',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7
  },
  'claw_attack': {
    attributeId: 'claw_strike',
    name: 'Claw Strike',
    category: 'melee',
    spriteAnimationId: 'attack_melee_claw',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7
  },
  'claw_swipe': {
    attributeId: 'claw_strike',
    name: 'Claw Strike',
    category: 'melee',
    spriteAnimationId: 'attack_melee_claw',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7
  },
  'bite_attack': {
    attributeId: 'bite_attack',
    name: 'Bite Attack',
    category: 'melee',
    spriteAnimationId: 'attack_melee_bite',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7
  },
  'bite': {
    attributeId: 'bite_attack',
    name: 'Bite Attack',
    category: 'melee',
    spriteAnimationId: 'attack_melee_bite',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7
  },
  'sword_strike': {
    attributeId: 'sword_strike',
    name: 'Sword Strike',
    category: 'melee',
    spriteAnimationId: 'attack_melee_sword',
    damageType: 'physical',
    attackType: 'melee',
    priority: 6
  },
  'sword_slash': {
    attributeId: 'sword_strike',
    name: 'Sword Strike',
    category: 'melee',
    spriteAnimationId: 'attack_melee_sword',
    damageType: 'physical',
    attackType: 'melee',
    priority: 6
  },
  'axe_chop': {
    attributeId: 'axe_chop',
    name: 'Axe Chop',
    category: 'melee',
    spriteAnimationId: 'attack_melee_axe',
    damageType: 'physical',
    attackType: 'melee',
    priority: 6
  },
  'axe_strike': {
    attributeId: 'axe_chop',
    name: 'Axe Chop',
    category: 'melee',
    spriteAnimationId: 'attack_melee_axe',
    damageType: 'physical',
    attackType: 'melee',
    priority: 6
  },

  // ===== RANGED ATTACKS =====
  'bow_shot': {
    attributeId: 'bow_shot',
    name: 'Bow Shot',
    category: 'ranged',
    spriteAnimationId: 'attack_ranged_bow',
    damageType: 'physical',
    attackType: 'ranged',
    priority: 7
  },
  'arrow_shot': {
    attributeId: 'bow_shot',
    name: 'Bow Shot',
    category: 'ranged',
    spriteAnimationId: 'attack_ranged_bow',
    damageType: 'physical',
    attackType: 'ranged',
    priority: 7
  },
  'crossbow_shot': {
    attributeId: 'crossbow_shot',
    name: 'Crossbow Shot',
    category: 'ranged',
    spriteAnimationId: 'attack_ranged_crossbow',
    damageType: 'physical',
    attackType: 'ranged',
    priority: 7
  },
  'magic_missile': {
    attributeId: 'magic_missile',
    name: 'Magic Missile',
    category: 'spell',
    spriteAnimationId: 'attack_ranged_magic',
    damageType: 'physical',
    attackType: 'ranged',
    priority: 7
  },

  // ===== SPECIAL ABILITIES =====
  'flight': {
    attributeId: 'flight',
    name: 'Flight',
    category: 'ability',
    spriteAnimationId: 'fly_default',
    damageType: 'none',
    attackType: 'passive',
    priority: 5
  },
  'flying': {
    attributeId: 'flight',
    name: 'Flight',
    category: 'ability',
    spriteAnimationId: 'fly_default',
    damageType: 'none',
    attackType: 'passive',
    priority: 5
  },
  'wing_attack': {
    attributeId: 'wing_attack',
    name: 'Wing Attack',
    category: 'melee',
    spriteAnimationId: 'wing_attack',
    damageType: 'physical',
    attackType: 'melee',
    priority: 8
  },
  'tail_whip': {
    attributeId: 'tail_whip',
    name: 'Tail Whip',
    category: 'melee',
    spriteAnimationId: 'tail_whip',
    damageType: 'physical',
    attackType: 'melee',
    priority: 8
  },
  'tail_sweep': {
    attributeId: 'tail_whip',
    name: 'Tail Whip',
    category: 'melee',
    spriteAnimationId: 'tail_whip',
    damageType: 'physical',
    attackType: 'melee',
    priority: 8
  },
  'roar': {
    attributeId: 'roar',
    name: 'Roar',
    category: 'ability',
    spriteAnimationId: 'roar',
    damageType: 'none',
    attackType: 'debuff',
    priority: 6
  },
  'battle_cry': {
    attributeId: 'roar',
    name: 'Roar',
    category: 'ability',
    spriteAnimationId: 'roar',
    damageType: 'none',
    attackType: 'debuff',
    priority: 6
  },
  'stomp': {
    attributeId: 'stomp',
    name: 'Stomp',
    category: 'melee',
    spriteAnimationId: 'stomp',
    damageType: 'physical',
    attackType: 'aoe',
    priority: 7
  },
  'ground_slam': {
    attributeId: 'stomp',
    name: 'Stomp',
    category: 'melee',
    spriteAnimationId: 'stomp',
    damageType: 'physical',
    attackType: 'aoe',
    priority: 7
  },
  'charge': {
    attributeId: 'charge',
    name: 'Charge',
    category: 'melee',
    spriteAnimationId: 'charge_attack',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7
  },
  'charge_attack': {
    attributeId: 'charge',
    name: 'Charge',
    category: 'melee',
    spriteAnimationId: 'charge_attack',
    damageType: 'physical',
    attackType: 'melee',
    priority: 7
  },

  // ===== DEFENSIVE ABILITIES =====
  'shield_block': {
    attributeId: 'shield_block',
    name: 'Shield Block',
    category: 'defense',
    spriteAnimationId: 'defend_shield',
    damageType: 'none',
    attackType: 'passive',
    priority: 5
  },
  'shield_defense': {
    attributeId: 'shield_block',
    name: 'Shield Block',
    category: 'defense',
    spriteAnimationId: 'defend_shield',
    damageType: 'none',
    attackType: 'passive',
    priority: 5
  },
  'parry': {
    attributeId: 'parry',
    name: 'Parry',
    category: 'defense',
    spriteAnimationId: 'parry_default',
    damageType: 'none',
    attackType: 'passive',
    priority: 5
  },
  'counter': {
    attributeId: 'counter',
    name: 'Counter Attack',
    category: 'defense',
    spriteAnimationId: 'counter_attack',
    damageType: 'physical',
    attackType: 'melee',
    priority: 6
  },
  'counter_attack': {
    attributeId: 'counter',
    name: 'Counter Attack',
    category: 'defense',
    spriteAnimationId: 'counter_attack',
    damageType: 'physical',
    attackType: 'melee',
    priority: 6
  },

  // ===== HEALING & BUFFS =====
  'heal': {
    attributeId: 'heal',
    name: 'Heal',
    category: 'spell',
    spriteAnimationId: 'heal_spell',
    damageType: 'holy',
    attackType: 'buff',
    priority: 6
  },
  'healing_spell': {
    attributeId: 'heal',
    name: 'Heal',
    category: 'spell',
    spriteAnimationId: 'heal_spell',
    damageType: 'holy',
    attackType: 'buff',
    priority: 6
  },
  'buff': {
    attributeId: 'buff',
    name: 'Buff',
    category: 'spell',
    spriteAnimationId: 'buff_spell',
    damageType: 'none',
    attackType: 'buff',
    priority: 5
  },
  'enhancement': {
    attributeId: 'buff',
    name: 'Buff',
    category: 'spell',
    spriteAnimationId: 'buff_spell',
    damageType: 'none',
    attackType: 'buff',
    priority: 5
  },

  // ===== POISON & DARK =====
  'poison_spit': {
    attributeId: 'poison_spit',
    name: 'Poison Spit',
    category: 'ranged',
    spriteAnimationId: 'spit_poison',
    damageType: 'poison',
    attackType: 'ranged',
    priority: 8
  },
  'poison_spray': {
    attributeId: 'poison_spit',
    name: 'Poison Spit',
    category: 'ranged',
    spriteAnimationId: 'spit_poison',
    damageType: 'poison',
    attackType: 'ranged',
    priority: 8
  },
  'web_shot': {
    attributeId: 'web_shot',
    name: 'Web Shot',
    category: 'ranged',
    spriteAnimationId: 'web_shot',
    damageType: 'none',
    attackType: 'debuff',
    priority: 7
  },
  'web_spray': {
    attributeId: 'web_shot',
    name: 'Web Shot',
    category: 'ranged',
    spriteAnimationId: 'web_shot',
    damageType: 'none',
    attackType: 'debuff',
    priority: 7
  },
  'dark_spell': {
    attributeId: 'dark_spell',
    name: 'Dark Spell',
    category: 'spell',
    spriteAnimationId: 'cast_dark_spell',
    damageType: 'dark',
    attackType: 'ranged',
    priority: 8
  },
  'shadow_spell': {
    attributeId: 'dark_spell',
    name: 'Dark Spell',
    category: 'spell',
    spriteAnimationId: 'cast_dark_spell',
    damageType: 'dark',
    attackType: 'ranged',
    priority: 8
  },

  // ===== MOVEMENT ABILITIES =====
  'dash': {
    attributeId: 'dash',
    name: 'Dash',
    category: 'ability',
    spriteAnimationId: 'dash_default',
    damageType: 'none',
    attackType: 'passive',
    priority: 4
  },
  'teleport': {
    attributeId: 'teleport',
    name: 'Teleport',
    category: 'spell',
    spriteAnimationId: 'teleport',
    damageType: 'none',
    attackType: 'passive',
    priority: 6
  },
  'blink': {
    attributeId: 'teleport',
    name: 'Teleport',
    category: 'spell',
    spriteAnimationId: 'teleport',
    damageType: 'none',
    attackType: 'passive',
    priority: 6
  },
  'stealth': {
    attributeId: 'stealth',
    name: 'Stealth',
    category: 'ability',
    spriteAnimationId: 'stealth',
    damageType: 'none',
    attackType: 'passive',
    priority: 5
  },
  'invisibility': {
    attributeId: 'stealth',
    name: 'Stealth',
    category: 'ability',
    spriteAnimationId: 'stealth',
    damageType: 'none',
    attackType: 'passive',
    priority: 5
  }
};

/**
 * Get combat attribute definition for an ability string
 *
 * @param ability - Ability string from Claude
 * @returns Combat attribute definition or null if not found
 */
export function getAttributeForAbility(ability: string): CombatAttribute | null {
  const normalized = ability.toLowerCase().trim().replace(/\s+/g, '_');
  return attributeMap[normalized] || null;
}

/**
 * Get all unique attribute IDs from ability list
 *
 * @param abilities - List of ability strings
 * @returns Array of unique combat attributes
 */
export function extractUniqueAttributes(abilities: string[]): CombatAttribute[] {
  const uniqueMap = new Map<string, CombatAttribute>();

  for (const ability of abilities) {
    const attribute = getAttributeForAbility(ability);
    if (attribute && !uniqueMap.has(attribute.attributeId)) {
      uniqueMap.set(attribute.attributeId, attribute);
    }
  }

  return Array.from(uniqueMap.values());
}
