/**
 * Animation Library
 *
 * Comprehensive library of 50+ animation definitions for creatures.
 * Organized by category with tags for fuzzy matching.
 */

import type { AnimationDefinition } from './types.js';

/**
 * Complete animation library
 * Contains 50+ animations across all categories
 */
export const animationLibrary: AnimationDefinition[] = [
  // ===== IDLE ANIMATIONS (5) =====
  {
    id: 'idle_default',
    name: 'Idle',
    category: 'idle',
    tags: ['base', 'standing', 'still', 'wait'],
    description: 'Basic idle stance'
  },
  {
    id: 'idle_breathing',
    name: 'Breathing Idle',
    category: 'idle',
    tags: ['organic', 'living', 'breathe', 'rest'],
    description: 'Idle with breathing motion'
  },
  {
    id: 'idle_alert',
    name: 'Alert Idle',
    category: 'idle',
    tags: ['ready', 'vigilant', 'combat'],
    description: 'Alert combat stance'
  },
  {
    id: 'idle_tired',
    name: 'Tired Idle',
    category: 'idle',
    tags: ['exhausted', 'low_hp', 'wounded'],
    description: 'Idle when low on health'
  },
  {
    id: 'idle_flying',
    name: 'Hover',
    category: 'idle',
    tags: ['flying', 'aerial', 'float', 'levitate'],
    description: 'Hovering in place'
  },

  // ===== LOCOMOTION ANIMATIONS (12) =====
  {
    id: 'walk_default',
    name: 'Walk',
    category: 'locomotion',
    tags: ['base', 'move', 'movement', 'slow'],
    description: 'Basic walking'
  },
  {
    id: 'run_default',
    name: 'Run',
    category: 'locomotion',
    tags: ['fast', 'sprint', 'speed', 'rush'],
    description: 'Running'
  },
  {
    id: 'fly_default',
    name: 'Fly',
    category: 'locomotion',
    tags: ['aerial', 'flying', 'wings', 'air', 'flight'],
    description: 'Flying through air'
  },
  {
    id: 'glide_default',
    name: 'Glide',
    category: 'locomotion',
    tags: ['aerial', 'flying', 'soar', 'wings'],
    description: 'Gliding smoothly'
  },
  {
    id: 'swim_default',
    name: 'Swim',
    category: 'locomotion',
    tags: ['water', 'aquatic', 'underwater'],
    description: 'Swimming through water'
  },
  {
    id: 'jump_default',
    name: 'Jump',
    category: 'locomotion',
    tags: ['leap', 'hop', 'spring'],
    description: 'Jumping up'
  },
  {
    id: 'land_default',
    name: 'Land',
    category: 'locomotion',
    tags: ['fall', 'drop', 'ground'],
    description: 'Landing from jump/fall'
  },
  {
    id: 'dash_default',
    name: 'Dash',
    category: 'locomotion',
    tags: ['quick', 'burst', 'speed', 'rush'],
    description: 'Quick dash forward'
  },
  {
    id: 'crawl_default',
    name: 'Crawl',
    category: 'locomotion',
    tags: ['stealth', 'sneak', 'low'],
    description: 'Crawling low'
  },
  {
    id: 'turn_left',
    name: 'Turn Left',
    category: 'locomotion',
    tags: ['rotate', 'pivot', 'turn'],
    description: 'Turning to the left'
  },
  {
    id: 'turn_right',
    name: 'Turn Right',
    category: 'locomotion',
    tags: ['rotate', 'pivot', 'turn'],
    description: 'Turning to the right'
  },
  {
    id: 'teleport',
    name: 'Teleport',
    category: 'locomotion',
    tags: ['magic', 'warp', 'blink', 'portal'],
    description: 'Teleporting to new location'
  },

  // ===== COMBAT ANIMATIONS (15) =====
  {
    id: 'attack_melee_default',
    name: 'Melee Attack',
    category: 'combat',
    tags: ['melee', 'close', 'hit', 'strike', 'slash'],
    description: 'Basic melee attack'
  },
  {
    id: 'attack_melee_sword',
    name: 'Sword Slash',
    category: 'combat',
    tags: ['melee', 'sword', 'blade', 'cut', 'slash'],
    description: 'Sword slashing attack'
  },
  {
    id: 'attack_melee_punch',
    name: 'Punch',
    category: 'combat',
    tags: ['melee', 'unarmed', 'fist', 'punch', 'brawl'],
    description: 'Punching attack'
  },
  {
    id: 'attack_melee_claw',
    name: 'Claw Swipe',
    category: 'combat',
    tags: ['melee', 'claw', 'scratch', 'swipe', 'beast'],
    description: 'Clawing attack'
  },
  {
    id: 'attack_melee_bite',
    name: 'Bite',
    category: 'combat',
    tags: ['melee', 'bite', 'teeth', 'chomp', 'beast'],
    description: 'Biting attack'
  },
  {
    id: 'attack_ranged_default',
    name: 'Ranged Attack',
    category: 'combat',
    tags: ['ranged', 'projectile', 'shoot', 'throw'],
    description: 'Basic ranged attack'
  },
  {
    id: 'attack_ranged_bow',
    name: 'Shoot Arrow',
    category: 'combat',
    tags: ['ranged', 'bow', 'arrow', 'archer'],
    description: 'Shooting bow and arrow'
  },
  {
    id: 'attack_ranged_throw',
    name: 'Throw Projectile',
    category: 'combat',
    tags: ['ranged', 'throw', 'toss', 'hurl'],
    description: 'Throwing a projectile'
  },
  {
    id: 'defend_default',
    name: 'Defend',
    category: 'combat',
    tags: ['block', 'guard', 'shield', 'parry', 'defense'],
    description: 'Defensive stance'
  },
  {
    id: 'defend_shield',
    name: 'Shield Block',
    category: 'combat',
    tags: ['shield', 'block', 'guard', 'protect'],
    description: 'Blocking with shield'
  },
  {
    id: 'dodge_default',
    name: 'Dodge',
    category: 'combat',
    tags: ['evade', 'avoid', 'sidestep', 'roll'],
    description: 'Dodging attack'
  },
  {
    id: 'roll_default',
    name: 'Roll',
    category: 'combat',
    tags: ['evade', 'roll', 'tumble', 'dodge'],
    description: 'Combat roll'
  },
  {
    id: 'parry_default',
    name: 'Parry',
    category: 'combat',
    tags: ['deflect', 'counter', 'riposte', 'blade'],
    description: 'Parrying attack'
  },
  {
    id: 'counter_attack',
    name: 'Counter Attack',
    category: 'combat',
    tags: ['counter', 'riposte', 'retaliate'],
    description: 'Counter-attacking'
  },
  {
    id: 'charge_attack',
    name: 'Charge',
    category: 'combat',
    tags: ['charge', 'rush', 'ram', 'bull_rush'],
    description: 'Charging attack'
  },

  // ===== ABILITIES ANIMATIONS (15) =====
  {
    id: 'cast_spell_default',
    name: 'Cast Spell',
    category: 'abilities',
    tags: ['magic', 'spell', 'cast', 'channel', 'arcane'],
    description: 'Casting a spell'
  },
  {
    id: 'cast_fire_spell',
    name: 'Cast Fire Spell',
    category: 'abilities',
    tags: ['magic', 'fire', 'flames', 'burn', 'pyro'],
    description: 'Casting fire magic'
  },
  {
    id: 'cast_ice_spell',
    name: 'Cast Ice Spell',
    category: 'abilities',
    tags: ['magic', 'ice', 'frost', 'freeze', 'cold'],
    description: 'Casting ice magic'
  },
  {
    id: 'cast_lightning_spell',
    name: 'Cast Lightning',
    category: 'abilities',
    tags: ['magic', 'lightning', 'thunder', 'electric', 'bolt'],
    description: 'Casting lightning magic'
  },
  {
    id: 'heal_spell',
    name: 'Heal',
    category: 'abilities',
    tags: ['magic', 'heal', 'restore', 'cure', 'holy'],
    description: 'Healing spell'
  },
  {
    id: 'buff_spell',
    name: 'Buff',
    category: 'abilities',
    tags: ['magic', 'buff', 'enhance', 'strengthen'],
    description: 'Buffing spell'
  },
  {
    id: 'breathe_fire',
    name: 'Fire Breath',
    category: 'abilities',
    tags: ['dragon', 'fire', 'breath', 'flames'],
    description: 'Breathing fire'
  },
  {
    id: 'roar',
    name: 'Roar',
    category: 'abilities',
    tags: ['intimidate', 'roar', 'shout', 'bellow', 'beast'],
    description: 'Powerful roar'
  },
  {
    id: 'tail_whip',
    name: 'Tail Whip',
    category: 'abilities',
    tags: ['tail', 'whip', 'sweep', 'dragon', 'beast'],
    description: 'Tail whipping attack'
  },
  {
    id: 'wing_attack',
    name: 'Wing Attack',
    category: 'abilities',
    tags: ['wing', 'gust', 'blow', 'aerial'],
    description: 'Attacking with wings'
  },
  {
    id: 'stomp',
    name: 'Stomp',
    category: 'abilities',
    tags: ['stomp', 'ground', 'shockwave', 'quake'],
    description: 'Ground stomp'
  },
  {
    id: 'summon',
    name: 'Summon',
    category: 'abilities',
    tags: ['summon', 'conjure', 'spawn', 'magic'],
    description: 'Summoning minions'
  },
  {
    id: 'special_move_1',
    name: 'Special Move 1',
    category: 'abilities',
    tags: ['special', 'ultimate', 'signature'],
    description: 'Special signature move'
  },
  {
    id: 'special_move_2',
    name: 'Special Move 2',
    category: 'abilities',
    tags: ['special', 'ultimate', 'signature'],
    description: 'Second special move'
  },
  {
    id: 'stealth',
    name: 'Stealth',
    category: 'abilities',
    tags: ['stealth', 'invisible', 'hide', 'vanish'],
    description: 'Entering stealth'
  },

  // ===== REACTIONS ANIMATIONS (8) =====
  {
    id: 'hit_default',
    name: 'Hit',
    category: 'reactions',
    tags: ['hit', 'hurt', 'damage', 'flinch', 'struck'],
    description: 'Taking damage'
  },
  {
    id: 'death_default',
    name: 'Death',
    category: 'reactions',
    tags: ['death', 'die', 'killed', 'defeat', 'fall'],
    description: 'Death animation'
  },
  {
    id: 'celebrate',
    name: 'Celebrate',
    category: 'reactions',
    tags: ['victory', 'cheer', 'celebrate', 'win'],
    description: 'Victory celebration'
  },
  {
    id: 'taunt',
    name: 'Taunt',
    category: 'reactions',
    tags: ['taunt', 'mock', 'provoke', 'gesture'],
    description: 'Taunting enemy'
  },
  {
    id: 'scared',
    name: 'Scared',
    category: 'reactions',
    tags: ['fear', 'scared', 'afraid', 'cower'],
    description: 'Showing fear'
  },
  {
    id: 'stun',
    name: 'Stunned',
    category: 'reactions',
    tags: ['stun', 'daze', 'dizzy', 'shock'],
    description: 'Stunned state'
  },
  {
    id: 'knockback',
    name: 'Knockback',
    category: 'reactions',
    tags: ['knockback', 'push', 'blow', 'thrown'],
    description: 'Being knocked back'
  },
  {
    id: 'revive',
    name: 'Revive',
    category: 'reactions',
    tags: ['revive', 'resurrect', 'wake', 'rise'],
    description: 'Reviving from death'
  }
];

/**
 * Get all animations in a specific category
 */
export function getAnimationsByCategory(category: string): AnimationDefinition[] {
  return animationLibrary.filter(anim => anim.category === category);
}

/**
 * Find animation by ID
 */
export function getAnimationById(id: string): AnimationDefinition | undefined {
  return animationLibrary.find(anim => anim.id === id);
}

/**
 * Search animations by tags
 */
export function searchAnimationsByTags(tags: string[]): AnimationDefinition[] {
  return animationLibrary.filter(anim =>
    tags.some(tag => anim.tags.includes(tag.toLowerCase()))
  );
}

/**
 * Get default base animations (required for all creatures)
 */
export function getDefaultBaseAnimations(): {
  idle: string;
  walk: string;
  attack: string;
  death: string;
} {
  return {
    idle: 'idle_default',
    walk: 'walk_default',
    attack: 'attack_melee_default',
    death: 'death_default'
  };
}

/**
 * Get statistics about the animation library
 */
export function getLibraryStats(): {
  total: number;
  byCategory: Record<string, number>;
} {
  const stats = {
    total: animationLibrary.length,
    byCategory: {} as Record<string, number>
  };

  for (const anim of animationLibrary) {
    stats.byCategory[anim.category] = (stats.byCategory[anim.category] || 0) + 1;
  }

  return stats;
}

console.log(`[Animation Library] Loaded ${animationLibrary.length} animations`);
console.log('[Animation Library] Categories:', getLibraryStats().byCategory);
