# L2 EPIC: Combat Mechanics & Ability System

**Epic ID**: `battle-combat-mechanics`
**Parent Theme**: Battle Engine (L1)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

---

## Epic Summary

Implement the core combat formulas, damage calculation systems, ability execution logic, buff/debuff mechanics, and rock-paper-scissors counter system that defines how creatures interact in battle. This epic provides the "game balance" layer—the formulas and rules that determine whether melee beats ranged, how armor reduces damage, when abilities should activate, and what makes combat strategically interesting beyond random outcomes.

**User Value**: Creates strategic depth through counter-play (ranged beats melee at distance, tanks absorb damage for squishy units, AOE abilities punish clustering), making deployment decisions meaningful and battles feel fair rather than random.

**Business Value**: Balanced combat mechanics ensure long-term retention (players don't quit due to "unfair" matchups), enable competitive viability (future ranked mode), and provide tunable knobs for game balance iterations.

---

## Purpose

The Combat Mechanics & Ability System is essential because it defines what makes Drawn of War a strategy game rather than a random number generator. While the authoritative server executes combat logic and the client renders animations, this epic specifies the formulas and rules that govern interactions:

- **Damage Formula**: How much damage does a 50-attack creature deal to a 20-armor target? (Answer: 35 damage with linear armor reduction)
- **Ability Activation**: When does a mage use fireball vs basic attack? (Answer: When 3+ enemies in AOE range)
- **Counter System**: Why do ranged units beat melee tanks? (Answer: Range advantage allows attacking before melee reaches)
- **Buff/Debuff Stacking**: Do two shields double protection or stack additively? (Answer: Additive stacking with diminishing returns)

Without well-designed combat mechanics, battles devolve into "bigger numbers always win" or feel frustratingly random. This epic provides the mathematical foundation that makes strategic deployment and creature choice matter.

---

## Scope

### Included

- **Core Damage System**
  - Base damage formula: `FinalDamage = max(1, BaseDamage - ArmorReduction)`
  - Armor reduction: Linear scaling (1 armor = -1 damage, minimum 1 damage)
  - Critical hits: 10% chance for 1.5x damage (server RNG)
  - Damage types: Physical, Magic, True (ignores armor)
  - Damage variance: ±10% randomness for variety
  - Overkill detection: Track wasted damage on dying units

- **Attack Range & Targeting**
  - Melee range: 1-2 hexes (adjacent or diagonal)
  - Ranged range: 3-6 hexes (bow, gun, sling)
  - Magic range: 4-8 hexes (spells, elemental attacks)
  - Line-of-sight: No blocking for MVP (flat battlefield)
  - Range penalties: None for MVP (all attacks full damage at max range)
  - Target priority: Closest enemy (Mechabellum-style simple AI)

- **Ability Types & Execution**
  - **Single-Target Abilities**: Extra damage to one enemy (e.g., Power Strike)
  - **AOE Abilities**: Damage all units in radius (e.g., Fireball, Earthquake)
  - **Buff Abilities**: Boost ally stats temporarily (e.g., Battle Cry, Shield)
  - **Debuff Abilities**: Weaken enemy stats temporarily (e.g., Slow, Poison)
  - **Heal Abilities**: Restore HP to self or allies (e.g., Heal, Regeneration)
  - **Summon Abilities**: Excluded from MVP (too complex)
  - **Terrain Abilities**: Excluded from MVP (no terrain interaction)

- **Ability Activation Logic**
  - Cooldown tracking: Abilities ready every N seconds
  - Activation conditions: Range check, target count, HP threshold
  - Priority order: High-impact abilities (AOE) prioritized over basic attacks
  - Resource costs: None for MVP (no mana system)
  - Interrupt prevention: Abilities execute atomically (no canceling mid-cast)

- **Buff/Debuff System**
  - **Buffs**: Damage boost, armor boost, speed boost, heal-over-time
  - **Debuffs**: Damage reduction, armor reduction, slow, damage-over-time (poison/burn)
  - **Stun**: Creature cannot act for duration (excluded from MVP - too disruptive)
  - **Duration tracking**: Buffs/debuffs expire after N seconds
  - **Stacking rules**: Same buff stacks additively (2 shields = +armor × 2)
  - **Buff/debuff removal**: On death, all effects removed
  - **Visual indicators**: Client renders aura/icon above buffed/debuffed units

- **Rock-Paper-Scissors Counter System**
  - **Melee (Tank) beats Magic (Squishy)**: High HP absorbs burst, gap-closes fast
  - **Ranged (Archer) beats Melee (Tank)**: Range advantage, kite away
  - **Magic (Burst) beats Ranged (Squishy)**: AOE abilities, high single-target damage
  - **Counter-counters**: AOE beats clustering, healing counters sustained damage
  - Tunable via creature stat distributions (HP, armor, damage, range)

- **Creature Stat Balancing**
  - Stat categories: HP (100-500), Armor (0-50), Damage (10-100), Speed (1-5 hexes/sec), Range (1-8 hexes)
  - Archetype templates:
    - **Tank**: High HP (400), high armor (40), low damage (20), melee range (1-2), slow (1 hex/sec)
    - **Melee DPS**: Medium HP (200), medium armor (20), high damage (60), melee range (1-2), fast (3 hex/sec)
    - **Ranged DPS**: Low HP (150), low armor (10), medium damage (40), ranged (5 hexes), medium speed (2 hex/sec)
    - **Mage**: Low HP (120), low armor (5), high damage (80), magic range (6 hexes), slow (1.5 hex/sec)
    - **Support**: Low HP (100), medium armor (15), low damage (15), magic range (5 hexes), medium speed (2 hex/sec), heal ability
  - Power budget formula: Total power = (HP × 0.5) + (Armor × 2) + (Damage × 3) + (Range × 5) + (Speed × 10)
  - AI-generated creatures assigned stats based on visual analysis

- **Combat Balance Tuning**
  - Average battle duration: 60-120 seconds (target)
  - Kill time: Average unit dies in 5-10 hits
  - Comeback potential: Losing player (3 units vs 6 units) has 20% win chance with good abilities
  - Ability impact: Abilities deal 2-3x damage of basic attacks (make them feel impactful)
  - Healing cap: Healing cannot exceed 50% of max HP per battle (prevent infinite stalling)

- **Combat Event Logging**
  - Damage dealt per creature (for MVP creature awards)
  - Healing done per creature
  - Abilities used per creature
  - Damage taken per creature
  - Kill/death ratios per creature type

### Explicitly Excluded

- **Mana/Resource System**: No mana costs for MVP (cooldowns only)
- **Stun/Hard CC**: No stun abilities (too disruptive for auto-battler)
- **Unit Summoning**: No spawning new creatures mid-battle (post-MVP)
- **Terrain Interactions**: No high ground bonuses, cover, obstacles (post-MVP)
- **Weather/Environmental Effects**: No rain slowing units, fire zones (post-MVP)
- **Advanced Targeting AI**: No focus-fire, protect-healer logic (post-MVP)
- **Combo Systems**: No ability synergies or chains (post-MVP)
- **Equipment/Items**: No weapons, armor, consumables (post-MVP)
- **Persistent Damage**: Units reset health between rounds (no carry-over)

---

## Key User Journeys

### 1. Melee vs Ranged Engagement
**Setup**: Player A has melee tanks, Player B has ranged archers
1. Round starts, units pathfind toward each other
2. **Distance 6 hexes**: Archers in range, tanks not yet → Archers attack (20 damage per hit)
3. **Distance 5 hexes**: Archers attack again → Tanks take 40 damage total
4. **Distance 4 hexes**: Archers attack again → Tanks take 60 damage total
5. **Distance 2 hexes**: Tanks enter melee range → Tanks attack (50 damage, but archers have 150 HP)
6. **Distance 1 hex**: Tanks attack again (100 damage total) → Archer dies
7. **Result**: Tanks won but lost 60 HP in process → Archer player learns to spread units out to maximize range advantage

### 2. AOE Ability vs Clustered Units
**Setup**: Player A has mage with Fireball (AOE 2 hexes), Player B clustered 4 units in 2-hex radius
1. Mage reaches range 6 hexes, detects 4 enemies in AOE radius
2. Mage activates Fireball (cooldown 10s, damage 60 to all targets)
3. Server calculates: 4 enemies × 60 damage = 240 total damage
4. All 4 enemies take 60 damage (after armor: 45 damage each)
5. 2 enemies die (had 100 HP), 2 survive (had 200 HP)
6. **Result**: Single ability killed 2 units → Player B learns to spread deployment to avoid AOE

### 3. Buff Ability Turns Tide
**Setup**: Player A losing (3 units vs 5 units), has support with Battle Cry buff (+50% damage for 10s)
1. Support activates Battle Cry → 3 allied units gain +50% damage boost
2. Buffed tank attacks: Normal 20 damage → Boosted 30 damage
3. Buffed DPS attacks: Normal 60 damage → Boosted 90 damage
4. **10 seconds later**: 3 buffed units dealt 600 extra damage total → Killed 2 enemy units
5. **Result**: Player A wins 3 vs 3 → Comeback victory through ability timing

### 4. Poison Debuff Kills Over Time
**Setup**: Mage casts Poison on enemy tank (50 damage over 20 seconds = 2.5 DPS)
1. Poison applied at tick 0 → Tank takes 2.5 damage per tick
2. **Tick 60 (1 second)**: Tank takes 2.5 damage (HP 400 → 397.5)
3. **Tick 1200 (20 seconds)**: Tank takes 50 damage total (HP 400 → 350)
4. Poison expires, but tank weakened for remaining combat
5. **Result**: Poison enabled team to kill tank faster in sustained fight

### 5. Healing Prevents Wipe
**Setup**: Player A has healer with Heal ability (restores 100 HP, cooldown 15s)
1. Allied tank at 50 HP (low health, about to die)
2. Healer in range, activates Heal → Tank HP 50 → 150
3. Tank survives 3 more enemy attacks (60 damage total)
4. Healer's second Heal ready → Tank HP 90 → 190
5. **Result**: Tank survives entire battle, healer MVP

---

## Technical Architecture

### Components

**Damage Calculation (Server)**
- `DamageCalculator`: Computes final damage from base damage, armor, buffs
- `CriticalHitResolver`: RNG critical hit detection (10% chance)
- `DamageTypeResolver`: Handles physical vs magic vs true damage
- `ArmorCalculator`: Applies armor reduction to damage
- `DamageVarianceApplicator`: Adds ±10% randomness

**Ability Execution (Server)**
- `AbilityExecutor`: Main ability activation coordinator
- `AOETargetResolver`: Finds all units in radius
- `BuffApplicator`: Applies buffs to units
- `DebuffApplicator`: Applies debuffs to units
- `HealExecutor`: Restores HP with cap enforcement
- `AbilityCooldownManager`: Tracks cooldown timers per ability

**Ability Activation Logic (Server)**
- `AbilityActivationConditionChecker`: Evaluates when to use abilities
- `TargetCountEvaluator`: Counts enemies in AOE radius
- `HPThresholdChecker`: Checks if unit below HP threshold for healing
- `RangeChecker`: Validates ability range before activation
- `AbilityPriorityResolver`: Chooses which ability to use when multiple ready

**Buff/Debuff System (Server)**
- `StatusEffectManager`: Tracks all active buffs/debuffs per unit
- `BuffStack Calculator`: Applies stacking rules (additive, multiplicative)
- `DurationTracker`: Expires effects after N ticks
- `StatModifier`: Applies temporary stat changes from buffs/debuffs
- `VisualEffectBroadcaster`: Sends buff/debuff visual events to clients

**Balance & Tuning (Server)**
- `StatValidator`: Ensures creatures stay within balanced stat ranges
- `PowerBudgetCalculator`: Computes creature power score
- `ArchetypeClassifier`: Assigns creature to archetype (tank, DPS, mage, support)
- `BalanceAdjuster`: Applies nerfs/buffs to overpowered/underpowered creatures

**Combat Analytics (Server)**
- `DamageTracker`: Records damage dealt per creature
- `HealingTracker`: Records healing done per creature
- `AbilityUsageTracker`: Records ability activations
- `KillDeathTracker`: Records kills/deaths per creature
- `BalanceReporter`: Aggregates stats for balance tuning

### Key Technologies

- **TypeScript**: Type-safe combat formulas and stat calculations
- **Node.js**: Server-side combat logic execution
- **Redis**: Cache buff/debuff state during battles
- **PostgreSQL**: Persistent storage for combat analytics
- **Unit Testing**: Jest for formula validation and balance testing

### Data Model

**Primary Entities**
```typescript
interface CreatureStats {
  creatureId: string;
  hp: number; // 100-500
  maxHp: number;
  armor: number; // 0-50
  baseDamage: number; // 10-100
  attackSpeed: number; // attacks per second (0.5-2.0)
  movementSpeed: number; // hexes per second (1-5)
  attackRange: number; // hexes (1-8)
  damageType: 'physical' | 'magic' | 'true';
  archetype: 'tank' | 'melee_dps' | 'ranged_dps' | 'mage' | 'support';
}

interface Ability {
  abilityId: string;
  name: string;
  type: 'single_target' | 'aoe' | 'buff' | 'debuff' | 'heal';
  cooldownSeconds: number;
  range: number; // hexes
  damageAmount?: number; // For damage abilities
  healAmount?: number; // For heal abilities
  aoeRadius?: number; // For AOE abilities (hexes)
  buffEffect?: BuffEffect;
  debuffEffect?: DebuffEffect;
  activationConditions: AbilityCondition[];
}

interface BuffEffect {
  buffId: string;
  name: string;
  durationSeconds: number;
  effects: {
    damageMultiplier?: number; // 1.5 = +50% damage
    armorBonus?: number; // +20 armor
    speedMultiplier?: number; // 1.3 = +30% speed
    healPerSecond?: number; // Regeneration
  };
  stackingRule: 'additive' | 'multiplicative' | 'no_stack';
}

interface DebuffEffect {
  debuffId: string;
  name: string;
  durationSeconds: number;
  effects: {
    damageReduction?: number; // 0.7 = -30% damage dealt
    armorPenalty?: number; // -10 armor
    slowMultiplier?: number; // 0.5 = -50% speed
    damagePerSecond?: number; // Poison/burn
  };
  stackingRule: 'additive' | 'multiplicative' | 'no_stack';
}

interface AbilityCondition {
  conditionType: 'target_count' | 'hp_threshold' | 'ally_low_hp' | 'enemy_buffed';
  targetCount?: number; // e.g., 3+ enemies in AOE
  hpThreshold?: number; // e.g., self HP < 30%
  allyHpThreshold?: number; // e.g., any ally HP < 50% (for heals)
}

interface DamageCalculation {
  attackerDamage: number;
  targetArmor: number;
  damageType: 'physical' | 'magic' | 'true';
  isCritical: boolean;
  variance: number; // -10% to +10%
  buffs: BuffEffect[]; // Attacker buffs
  debuffs: DebuffEffect[]; // Target debuffs
  finalDamage: number;
}

interface CombatBalance {
  averageBattleDuration: number; // seconds
  averageKillTime: number; // hits to kill
  winRateByArchetype: Record<string, number>; // e.g., 'tank': 0.52
  abilityUsageRate: Record<string, number>; // abilities used per battle
  comebackWinRate: number; // % of battles won from 3v5+ disadvantage
}
```

**Damage Formula**
```typescript
function calculateDamage(params: {
  baseDamage: number;
  targetArmor: number;
  damageType: 'physical' | 'magic' | 'true';
  attackerBuffs: BuffEffect[];
  targetDebuffs: DebuffEffect[];
}): number {
  let damage = params.baseDamage;

  // Apply damage type
  let effectiveArmor = params.targetArmor;
  if (params.damageType === 'magic') {
    effectiveArmor = effectiveArmor * 0.5; // Magic ignores 50% armor
  } else if (params.damageType === 'true') {
    effectiveArmor = 0; // True damage ignores all armor
  }

  // Apply armor reduction (linear)
  damage = Math.max(1, damage - effectiveArmor);

  // Apply attacker buffs (damage multipliers)
  for (const buff of params.attackerBuffs) {
    if (buff.effects.damageMultiplier) {
      damage *= buff.effects.damageMultiplier;
    }
  }

  // Apply target debuffs (armor reduction)
  for (const debuff of params.targetDebuffs) {
    if (debuff.effects.armorPenalty) {
      // Already applied in effectiveArmor calculation
    }
  }

  // Apply variance (±10%)
  const variance = 1 + (Math.random() * 0.2 - 0.1); // 0.9 to 1.1
  damage *= variance;

  // Critical hit check (10% chance for 1.5x damage)
  if (Math.random() < 0.1) {
    damage *= 1.5;
  }

  return Math.floor(damage);
}
```

**Ability Activation Decision**
```typescript
function shouldUseAbility(unit: Unit, ability: Ability, targets: Unit[]): boolean {
  // Check cooldown
  if (ability.cooldownRemaining > 0) {
    return false;
  }

  // Check range
  const closestTarget = findClosestEnemy(unit, targets);
  if (!closestTarget || hexDistance(unit.position, closestTarget.position) > ability.range) {
    return false;
  }

  // Check activation conditions
  for (const condition of ability.activationConditions) {
    switch (condition.conditionType) {
      case 'target_count':
        // AOE abilities: Only use if N+ enemies in radius
        const targetsInRadius = targets.filter(t =>
          hexDistance(unit.position, t.position) <= ability.aoeRadius!
        );
        if (targetsInRadius.length < condition.targetCount!) {
          return false;
        }
        break;

      case 'hp_threshold':
        // Self-heal: Only use if HP below threshold
        if (unit.health / unit.maxHealth > condition.hpThreshold!) {
          return false;
        }
        break;

      case 'ally_low_hp':
        // Ally heal: Only use if any ally below threshold
        const lowHpAllies = getAllies(unit).filter(a =>
          a.health / a.maxHealth < condition.allyHpThreshold!
        );
        if (lowHpAllies.length === 0) {
          return false;
        }
        break;
    }
  }

  return true; // All conditions met
}
```

**Buff/Debuff Application**
```typescript
function applyBuff(unit: Unit, buff: BuffEffect) {
  // Check stacking
  const existingBuff = unit.activeBuffs.find(b => b.buffId === buff.buffId);

  if (existingBuff) {
    if (buff.stackingRule === 'no_stack') {
      // Refresh duration
      existingBuff.durationRemaining = buff.durationSeconds * 60; // Convert to ticks
      return;
    } else if (buff.stackingRule === 'additive') {
      // Add another stack
      unit.activeBuffs.push({...buff, appliedTick: currentTick});
    }
    // Multiplicative stacking handled in stat calculation
  } else {
    // New buff
    unit.activeBuffs.push({...buff, appliedTick: currentTick});
  }

  // Update unit stats
  recalculateUnitStats(unit);
}

function recalculateUnitStats(unit: Unit) {
  // Reset to base stats
  let damageMultiplier = 1.0;
  let armorBonus = 0;
  let speedMultiplier = 1.0;

  // Apply all buffs
  for (const buff of unit.activeBuffs) {
    if (buff.effects.damageMultiplier) {
      damageMultiplier *= buff.effects.damageMultiplier; // Multiplicative stacking
    }
    if (buff.effects.armorBonus) {
      armorBonus += buff.effects.armorBonus; // Additive stacking
    }
    if (buff.effects.speedMultiplier) {
      speedMultiplier *= buff.effects.speedMultiplier; // Multiplicative stacking
    }
  }

  // Apply all debuffs
  for (const debuff of unit.activeDebuffs) {
    if (debuff.effects.damageReduction) {
      damageMultiplier *= debuff.effects.damageReduction; // e.g., 0.7 = -30%
    }
    if (debuff.effects.armorPenalty) {
      armorBonus -= debuff.effects.armorPenalty; // e.g., -10 armor
    }
    if (debuff.effects.slowMultiplier) {
      speedMultiplier *= debuff.effects.slowMultiplier; // e.g., 0.5 = -50%
    }
  }

  // Update effective stats
  unit.effectiveDamage = unit.baseDamage * damageMultiplier;
  unit.effectiveArmor = unit.baseArmor + armorBonus;
  unit.effectiveSpeed = unit.baseSpeed * speedMultiplier;
}
```

---

## Dependencies

### Depends On

- **Authoritative Server Simulation** (L2): Executes combat formulas and ability logic
- **AI Generation Pipeline** (L1): Provides creature base stats and abilities
- **Hex Grid Deployment System** (L2): Provides distance calculations for range checks
- **Animation Library** (L3): Provides visual effects for abilities

### Depended On By

- **Client Rendering & Animation Sync** (L2): Renders ability effects and damage numbers
- **Multi-Round Battle System** (L2): Uses combat results for round scoring

---

## Key Technical Challenges

1. **Balancing Rock-Paper-Scissors**: Ensuring no archetype dominates all matchups while maintaining asymmetric gameplay. Requires extensive playtesting, stat tuning, and ability iteration.

2. **AI-Generated Creature Stat Assignment**: Mapping visual analysis (creature looks tanky) to numerical stats (high HP, low damage) without manual tuning. Requires robust creature classifier and power budget enforcement.

3. **Ability Activation Heuristics**: Simple AI must decide when to use abilities without complex planning. "Use fireball if 3+ enemies in AOE" is simple but may miss better timing (e.g., save fireball for clustered low-HP targets).

4. **Buff/Debuff Stacking Edge Cases**: Preventing infinite stacking loops (buff stacks infinitely), negative stat underflows (armor goes negative), and performance issues (1000 buff checks per tick).

5. **Combat Duration Tuning**: Balancing damage, armor, and HP so battles last 60-120s on average. Too fast = no strategic depth, too slow = boring. Must account for healing abilities extending duration.

6. **Comeback Mechanics**: Ensuring losing player (3 units vs 6) has fighting chance through abilities/positioning without making comebacks too easy (invalidating early advantage).

7. **Damage Variance vs Determinism**: Random variance (±10%, critical hits) makes battles feel less "samey" but reduces skill ceiling. Must balance excitement with competitive fairness.

---

## Success Criteria

### MVP Definition of Done

- [ ] Damage formula calculates correctly (base damage, armor reduction, minimum 1 damage)
- [ ] Critical hits occur at 10% rate with 1.5x damage multiplier
- [ ] Physical, magic, and true damage types work correctly with armor
- [ ] Melee (1-2 hex), ranged (3-6 hex), and magic (4-8 hex) ranges enforced
- [ ] Single-target abilities deal extra damage correctly
- [ ] AOE abilities damage all units in radius
- [ ] Buff abilities boost ally stats temporarily (damage, armor, speed)
- [ ] Debuff abilities weaken enemy stats temporarily
- [ ] Heal abilities restore HP with cap enforcement (max 50% of max HP per battle)
- [ ] Buffs/debuffs expire after duration correctly
- [ ] Stacking rules work (additive for armor, multiplicative for damage)
- [ ] Ability cooldowns prevent spamming
- [ ] Ability activation conditions work (target count, HP threshold)
- [ ] Rock-paper-scissors balance: Melee beats magic, ranged beats melee, magic beats ranged
- [ ] Average battle duration 60-120 seconds
- [ ] Combat analytics track damage, healing, abilities used per creature
- [ ] Power budget formula prevents overpowered creatures (±20% variance allowed)

### Exceptional Target (Post-MVP)

- [ ] Advanced targeting AI (focus fire low-HP targets, protect healers)
- [ ] Combo system (fireball on oil = explosion, lightning on water = chain)
- [ ] Mana/resource system for ability costs
- [ ] Stun/hard CC abilities with counterplay
- [ ] Terrain bonuses (high ground = +range, forest = +evasion)
- [ ] Equipment/items (weapons, armor, consumables)
- [ ] Persistent damage (units carry HP between rounds)
- [ ] Dynamic balance adjustments (nerf overperforming creatures automatically)

---

## Open Questions

1. **Critical Hit Rate**: 10% feels standard, but should critical hits exist in an auto-battler where players can't react? Alternative: Remove crits, increase damage variance to ±15%.

2. **Armor Formula**: Linear armor reduction (1 armor = -1 damage) is simple but scales poorly at high values (50 armor makes unit immune to 40 damage attacks). Should we use percentage-based reduction (e.g., damage × (100 / (100 + armor)))?

3. **Healing Cap**: 50% of max HP per battle prevents infinite stalling, but is it too restrictive? Should support archetypes get higher cap (75%) to make them viable?

4. **Ability Activation Priority**: When multiple abilities ready, should AI always prioritize AOE over single-target, or evaluate DPS and choose best? Simple rules vs complex decision tree.

5. **Buff/Debuff Stacking**: Should same buff stack additively (2 shields = +40 armor) or with diminishing returns (2 shields = +30 armor)? Additive is simpler but can break balance.

6. **Damage Type Distribution**: Should all creatures have one damage type (physical/magic), or can some have mixed damage (50% physical, 50% magic)? Mixed adds complexity but more variety.

7. **Rock-Paper-Scissors Enforcement**: Should counter matchups be strict (ranged ALWAYS beats melee) or soft (ranged has 60% win rate vs melee, but melee can win with good deployment)? Strict is clearer for new players, soft has more skill expression.

8. **Power Budget Variance**: AI-generated creatures may vary widely in power. Should we enforce strict power budget (all creatures equal power) or allow ±20% variance (some creatures stronger but rarer)?

---

## L3 Feature Candidates

### Core Damage System
- **Damage Calculation Engine** - Base damage, armor reduction, variance
- **Critical Hit System** - 10% chance, 1.5x damage
- **Damage Type Handler** - Physical, magic, true damage
- **Armor Calculator** - Linear armor reduction formula

### Ability Execution
- **Ability Executor** - Main ability activation coordinator
- **AOE Target Resolver** - Find all units in radius
- **Buff Applicator** - Apply buffs with stacking rules
- **Debuff Applicator** - Apply debuffs with duration tracking
- **Heal Executor** - Restore HP with cap enforcement

### Ability Activation Logic
- **Ability Condition Checker** - Evaluate activation conditions
- **Target Count Evaluator** - Count enemies in AOE
- **HP Threshold Checker** - Check HP for heal activation
- **Ability Priority Resolver** - Choose ability when multiple ready

### Buff/Debuff System
- **Status Effect Manager** - Track active buffs/debuffs
- **Stat Modifier** - Apply temporary stat changes
- **Duration Tracker** - Expire effects after N ticks
- **Buff Stack Calculator** - Handle stacking rules

### Balance & Tuning
- **Stat Validator** - Ensure balanced stat ranges
- **Power Budget Calculator** - Compute creature power score
- **Archetype Classifier** - Assign creature to archetype
- **Balance Adjuster** - Apply nerfs/buffs

### Combat Analytics
- **Damage Tracker** - Record damage dealt per creature
- **Healing Tracker** - Record healing done per creature
- **Ability Usage Tracker** - Record ability activations
- **Kill/Death Tracker** - Record kills/deaths
- **Balance Reporter** - Aggregate stats for tuning

---

## Metadata

- **Estimated Effort**: 4-6 weeks (core formulas and abilities), 8-10 weeks (with balance tuning)
- **Team Size**: 2-3 developers (1 backend, 1 game designer/balancer, 1 QA)
- **Priority**: CRITICAL (defines strategic depth)
- **Risks**: HIGH (balance is iterative, requires playtesting)
- **Blockers**: Requires Server Simulation for execution

---

*This document defines the combat formulas, ability systems, and balance mechanics. Ready for L3 feature breakdown and task definition.*
