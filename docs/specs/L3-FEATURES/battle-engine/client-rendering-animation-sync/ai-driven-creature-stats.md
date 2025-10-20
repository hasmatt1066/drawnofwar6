# L3 FEATURE: AI-Driven Creature Stats

**Feature ID**: `ai-creature-stats`
**Parent Epic**: Client Rendering & Animation Sync (L2)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-05

---

## Overview

The **AI-Driven Creature Stats** feature implements the backend AI analysis system that assigns combat-ready statistics to creatures during generation. Claude Vision API analyzes creature visual design (size, armor, weapons, abilities) and intelligently assigns:

- **Movement Speed**: 1-5 hexes/second based on creature archetype (slow tank vs fast assassin)
- **Attack Range**: 1-6 hexes based on weapon type (melee vs ranged vs spellcaster)
- **Attack Speed**: 1-3 attacks per 10 seconds based on weapon weight/class
- **Abilities**: 1-3 unique abilities selected from abilities catalog with power-based cooldowns
- **Cooldown Formula**: `(abilityPower * 2) + 3` seconds to balance strong abilities with longer waits
- **Combat Archetype**: Tank, melee_dps, ranged_dps, mage, support (affects all other stats)

**Purpose**: Transform raw creature generation data into tactically balanced combat units without manual player configuration, ensuring every creature has appropriate stats for their visual design.

**User Value**: Players see their created creatures immediately ready for battle with stats that "feel right" based on appearance. A heavily-armored knight is slow and tanky, while a nimble archer is fast with ranged attacks. This eliminates tedious stat configuration while maintaining strategic depth.

---

## Functional Requirements

### FR-1: Combat Stats Assignment Algorithm

**What**: AI assigns 6 core combat stats during creature generation based on visual analysis

**Input**:
- Creature visual analysis from Claude Vision API (race, class, size, weapons, armor)
- Text description (if provided by user)
- Detected abilities from visual features

**Output**:
```typescript
interface AssignedCombatStats {
  movementSpeed: number;        // 1-5 hexes/second
  attackRange: number;           // 1-6 hexes
  attackSpeed: number;           // 1-3 per 10 seconds
  attackDamage: number;          // Base damage per hit
  armor: number;                 // Damage reduction (0-30)
  maxHealth: number;             // 10-200 HP
  archetype: 'tank' | 'melee_dps' | 'ranged_dps' | 'mage' | 'support';
}
```

**Logic**:
1. **Archetype Detection** (primary driver):
   - Heavy armor + melee weapon → `tank`
   - Light armor + melee weapon → `melee_dps`
   - Bow/crossbow/gun → `ranged_dps`
   - Staff/wand/magic visuals → `mage`
   - Healing/buff visual indicators → `support`

2. **Movement Speed Assignment**:
   - Tank: 1-2 hexes/sec (slow, heavily armored)
   - Melee DPS: 3-4 hexes/sec (mobile, light armor)
   - Ranged DPS: 2-3 hexes/sec (moderate mobility)
   - Mage: 2-3 hexes/sec (robes, light)
   - Support: 2-3 hexes/sec (utility focus)

3. **Attack Range Assignment**:
   - Tank: 1 hex (melee only)
   - Melee DPS: 1-2 hexes (reach weapons possible)
   - Ranged DPS: 4-6 hexes (bows, crossbows)
   - Mage: 3-5 hexes (spell range)
   - Support: 2-4 hexes (varies by ability)

4. **Attack Speed Assignment**:
   - Tank: 1 attack/10s (slow, heavy weapons)
   - Melee DPS: 2-3 attacks/10s (fast, agile)
   - Ranged DPS: 2 attacks/10s (reload time)
   - Mage: 1-2 attacks/10s (casting time)
   - Support: 1 attack/10s (focus on abilities)

5. **Health/Damage/Armor Balance**:
   - Total power budget: 100-150 points
   - HP counts as points/10 (150 HP = 15 points)
   - Damage counts as points * 1 (40 damage = 40 points)
   - Armor counts as points * 2 (20 armor = 40 points)
   - Enforce budget: `(HP/10) + damage + (armor*2) = 100-150`

**Example Assignments**:
```
Heavily Armored Knight:
- Archetype: tank
- HP: 150, Damage: 20, Armor: 25
- Speed: 1.5 hexes/sec, Range: 1 hex, Attack Speed: 1/10s
- Power Budget: 15 + 20 + 50 = 85 points

Nimble Archer:
- Archetype: ranged_dps
- HP: 80, Damage: 35, Armor: 5
- Speed: 3 hexes/sec, Range: 5 hexes, Attack Speed: 2/10s
- Power Budget: 8 + 35 + 10 = 53 points

Fire Mage:
- Archetype: mage
- HP: 60, Damage: 45, Armor: 3
- Speed: 2.5 hexes/sec, Range: 4 hexes, Attack Speed: 1.5/10s
- Power Budget: 6 + 45 + 6 = 57 points
```

---

### FR-2: Ability Selection & Assignment

**What**: AI selects 1-3 abilities from abilities catalog based on creature visual features

**Input**:
- Claude Vision ability suggestions (e.g., "fire_breath", "claw_strike", "shield_bash")
- Creature archetype
- Visual features (wings, claws, weapons, magic effects)

**Output**:
```typescript
interface AssignedAbility {
  abilityId: string;           // From abilities catalog
  name: string;                 // Display name
  cooldownSeconds: number;      // Calculated cooldown
  power: number;                // 1-10 power rating
  range: number;                // Ability range in hexes
  type: 'single_target' | 'aoe' | 'buff' | 'debuff';
}
```

**Logic**:
1. **Match Visual Features to Catalog**:
   - Use semantic keyword matching from `abilitiesCatalog`
   - Claude says "fire breath" → match to `fire_breath` ability
   - Claude says "sword slash" → match to `sword_strike` ability

2. **Priority-Based Selection**:
   - Select 1-3 highest priority abilities that match creature visuals
   - Always include at least 1 offensive ability (attack type)
   - Prefer variety: melee + ranged, or damage + buff

3. **Cooldown Calculation**:
   - Formula: `cooldownSeconds = (abilityPower * 2) + 3`
   - Power 1 ability: 5 second cooldown
   - Power 5 ability: 13 second cooldown
   - Power 10 ability: 23 second cooldown
   - Balances strong abilities with longer wait times

4. **Ability Power Rating**:
   - Determined by ability definition in catalog
   - AOE abilities: higher power (7-10)
   - Single target: moderate power (4-6)
   - Buffs/debuffs: lower power (2-4)

**Example**:
```
Fire Dragon:
- Ability 1: Fire Breath (power: 8, cooldown: 19s, range: 4 hexes, AOE)
- Ability 2: Claw Strike (power: 5, cooldown: 13s, range: 1 hex, single target)
- Ability 3: Wing Buffet (power: 4, cooldown: 11s, range: 2 hexes, debuff)
```

---

### FR-3: Abilities Catalog Integration

**What**: Central configuration file defining all available abilities with metadata for AI matching

**Location**: `/mnt/c/Users/mhast/Desktop/drawnofwar6/backend/src/config/abilities-catalog.ts`

**Structure**:
```typescript
interface AbilityDefinition {
  id: string;                        // Unique ID (e.g., "fire_breath")
  name: string;                      // Display name
  keywords: string[];                // Semantic matching keywords
  category: AttributeCategory;       // melee/ranged/spell/ability/defense
  damageType: DamageType;           // physical/fire/ice/lightning/etc
  attackType: AttackType;           // melee/ranged/aoe/buff/debuff
  priority: number;                 // 1-10 selection priority
  spriteAnimationId: string;        // Animation from library
  power: number;                    // 1-10 power rating (for cooldown calc)
  range: number;                    // Base range in hexes
}
```

**Abilities Catalog** (50+ abilities):
- **Fire**: fire_breath, fire_spell, flame_aura
- **Ice**: ice_breath, ice_spell, frost_nova
- **Lightning**: lightning_breath, lightning_spell, chain_lightning
- **Melee**: claw_strike, bite_attack, sword_strike, axe_chop, tail_whip
- **Ranged**: bow_shot, crossbow_bolt, throwing_axe, javelin
- **Defensive**: shield_bash, parry, dodge_roll, block
- **Buffs**: battle_cry, bless, haste, regeneration
- **Debuffs**: curse, slow, poison, bleed

**Semantic Matching Algorithm**:
```typescript
function matchAbilityFromKeywords(
  claudeAbilities: string[],
  catalog: AbilityDefinition[]
): AbilityDefinition[] {
  const matches: AbilityDefinition[] = [];

  for (const claudeAbility of claudeAbilities) {
    const words = claudeAbility.toLowerCase().split(/\s+/);

    // Find catalog ability with highest keyword match score
    let bestMatch: AbilityDefinition | null = null;
    let bestScore = 0;

    for (const catalogAbility of catalog) {
      let score = 0;
      for (const keyword of catalogAbility.keywords) {
        if (words.some(word => keyword.includes(word) || word.includes(keyword))) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = catalogAbility;
      }
    }

    if (bestMatch && bestScore > 0) {
      matches.push(bestMatch);
    }
  }

  // Sort by priority, return top 3
  return matches.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
```

---

### FR-4: Integration with Claude Vision Prompt

**What**: Update Claude Vision API prompt to guide stat assignment

**Current Prompt Enhancement**:
```typescript
export function buildCreatureAnalysisPrompt(textContext?: string): string {
  return `...

4. **Primary Attributes**: Assign balanced stats based on visual appearance:
   - HP (Health): 10-200 (size, armor, bulk)
   - Attack: 1-50 (weapons, claws, visible power)
   - Defense: 0-30 (armor, shields, protective features)
   - Speed: 1-10 (body type, wings, sleek design)

   IMPORTANT: Balance stats so total power budget = 100-150 points
   Formula: (HP/10) + attack + (defense*2) = 100-150

5. **Combat Archetype**: Identify creature role:
   - "tank" - Heavy armor, high HP, low speed
   - "melee_dps" - Light armor, high attack, high speed
   - "ranged_dps" - Bow/ranged weapon, moderate stats
   - "mage" - Staff/wand, magic visuals, spell abilities
   - "support" - Healing/buff indicators, utility focus

6. **Abilities**: Identify 2-5 abilities using standard IDs from catalog:
   ${buildClaudeAbilityGuidance()}

   Use exact ability IDs: fire_breath, claw_strike, bow_shot, etc.
   Abilities should match visible features (wings→flight, claws→claw_strike)
...`;
}
```

**Ability Guidance Function**:
```typescript
export function buildClaudeAbilityGuidance(): string {
  const abilityCategories = [
    "Fire: fire_breath, fire_spell, flame_aura",
    "Ice: ice_breath, ice_spell, frost_nova",
    "Lightning: lightning_breath, lightning_spell, chain_lightning",
    "Melee: claw_strike, bite_attack, sword_strike, axe_chop, tail_whip",
    "Ranged: bow_shot, crossbow_bolt, throwing_axe",
    "Defensive: shield_bash, parry, dodge_roll",
    "Buffs: battle_cry, bless, haste",
    "Debuffs: curse, slow, poison"
  ];

  return `Available abilities (use IDs):\n${abilityCategories.join('\n')}`;
}
```

---

### FR-5: Stats Persistence & Transmission

**What**: Store assigned stats in generation result and transmit to combat engine

**Data Flow**:
1. **Generation Phase**:
   - Claude Vision analyzes creature → extracts stats/abilities
   - Stats assignment service validates and balances stats
   - Stats stored in `GenerationResult` object
   - Stats persisted to database with creature record

2. **Deployment Phase**:
   - Frontend loads creature from database
   - Creature includes full combat stats in `DeploymentCreature` type
   - Stats displayed in creature card UI

3. **Combat Initialization**:
   - Server receives `CreaturePlacement[]` from deployment
   - Extracts combat stats from each creature
   - Initializes `CombatCreature` instances with stats
   - Begins combat simulation with balanced creatures

**Type Definitions**:
```typescript
// Add to GenerationResult (backend/src/types/generation.ts)
export interface GenerationResult {
  // ... existing fields

  // Combat stats (AI-assigned)
  combatStats: AssignedCombatStats;

  // Combat abilities (AI-assigned)
  combatAbilities: AssignedAbility[];
}

// Add to DeploymentCreature (shared/src/types/deployment.ts)
export interface DeploymentCreature {
  // ... existing fields

  // Combat stats for battle initialization
  combatStats: {
    movementSpeed: number;
    attackRange: number;
    attackSpeed: number;
    attackDamage: number;
    armor: number;
    maxHealth: number;
    archetype: string;
  };

  // Combat abilities
  abilities: Array<{
    abilityId: string;
    name: string;
    cooldownSeconds: number;
    power: number;
    range: number;
    type: string;
  }>;
}
```

---

## Technical Architecture

### Components

**Backend Services** (`/backend/src/services/`):

1. **Stats Assignment Service** (`stats/stats-assigner.ts`):
   - Primary component for stat calculation
   - Implements archetype detection algorithm
   - Enforces power budget balancing
   - Exports: `assignCombatStats(claudeAnalysis) → AssignedCombatStats`

2. **Ability Matcher Service** (`abilities/ability-matcher.ts`):
   - Semantic keyword matching against abilities catalog
   - Priority-based selection (top 3 abilities)
   - Cooldown calculation
   - Exports: `matchAbilities(claudeAbilities) → AssignedAbility[]`

3. **Abilities Catalog** (`config/abilities-catalog.ts`):
   - Central ability definitions (50+ abilities)
   - Semantic keywords for matching
   - Metadata: power, range, type, animation
   - Exports: `abilitiesCatalog: AbilityDefinition[]`

4. **Claude Prompt Builder** (`claude/prompts.ts`):
   - Enhanced prompt with stat guidance
   - Ability catalog integration
   - Archetype detection instructions
   - Exports: `buildCreatureAnalysisPrompt()`

**Integration Point** (`/backend/src/queue/generation-processor.ts`):
```typescript
async function processGeneration(request: GenerationRequest): Promise<GenerationResult> {
  // Step 1: Claude Vision analysis
  const claudeAnalysis = await claudeVisionService.analyzeCreature(request);

  // Step 2: Assign combat stats (NEW)
  const combatStats = await statsAssigner.assignCombatStats(claudeAnalysis);

  // Step 3: Match abilities (NEW)
  const combatAbilities = await abilityMatcher.matchAbilities(
    claudeAnalysis.abilities,
    claudeAnalysis.archetype
  );

  // Step 4: Generate sprites (existing)
  const sprites = await pixelLabService.generateSprites(claudeAnalysis);

  // Step 5: Return complete result
  return {
    claudeAnalysis,
    combatStats,        // NEW
    combatAbilities,    // NEW
    sprites,
    // ... other fields
  };
}
```

---

### Key Algorithms

**Algorithm 1: Power Budget Balancing**
```typescript
function balanceStatsByBudget(
  baseStats: { hp: number; attack: number; armor: number },
  archetype: string
): AssignedCombatStats {
  const MIN_BUDGET = 100;
  const MAX_BUDGET = 150;

  // Calculate current budget
  const currentBudget = (baseStats.hp / 10) + baseStats.attack + (baseStats.armor * 2);

  // If within range, return as-is
  if (currentBudget >= MIN_BUDGET && currentBudget <= MAX_BUDGET) {
    return { ...baseStats, archetype };
  }

  // Calculate scaling factor
  const targetBudget = (MIN_BUDGET + MAX_BUDGET) / 2; // 125
  const scaleFactor = targetBudget / currentBudget;

  // Scale all stats proportionally
  const balanced = {
    hp: Math.round(baseStats.hp * scaleFactor),
    attack: Math.round(baseStats.attack * scaleFactor),
    armor: Math.round(baseStats.armor * scaleFactor)
  };

  // Verify new budget
  const newBudget = (balanced.hp / 10) + balanced.attack + (balanced.armor * 2);
  console.log(`Balanced stats: ${currentBudget} → ${newBudget} (target: ${targetBudget})`);

  return { ...balanced, archetype };
}
```

**Algorithm 2: Archetype Detection**
```typescript
function detectArchetype(claudeAnalysis: ClaudeAnalysisResult): string {
  const { class: creatureClass, race, primaryAttributes, abilities } = claudeAnalysis;

  // Rule-based archetype detection
  const rules = [
    {
      archetype: 'tank',
      conditions: [
        () => primaryAttributes.defense >= 20,
        () => primaryAttributes.hp >= 120,
        () => ['warrior', 'knight', 'guardian'].includes(creatureClass.toLowerCase())
      ]
    },
    {
      archetype: 'ranged_dps',
      conditions: [
        () => abilities.some(a => a.includes('bow') || a.includes('arrow') || a.includes('crossbow')),
        () => ['archer', 'ranger', 'marksman'].includes(creatureClass.toLowerCase())
      ]
    },
    {
      archetype: 'mage',
      conditions: [
        () => abilities.some(a => a.includes('spell') || a.includes('magic')),
        () => ['mage', 'wizard', 'sorcerer', 'warlock'].includes(creatureClass.toLowerCase())
      ]
    },
    {
      archetype: 'melee_dps',
      conditions: [
        () => primaryAttributes.speed >= 7,
        () => primaryAttributes.attack >= 30,
        () => ['rogue', 'assassin', 'berserker'].includes(creatureClass.toLowerCase())
      ]
    },
    {
      archetype: 'support',
      conditions: [
        () => abilities.some(a => a.includes('heal') || a.includes('buff') || a.includes('bless')),
        () => ['cleric', 'priest', 'paladin'].includes(creatureClass.toLowerCase())
      ]
    }
  ];

  // Find first matching archetype
  for (const rule of rules) {
    const matchCount = rule.conditions.filter(cond => cond()).length;
    if (matchCount >= 2) { // Require 2+ matching conditions
      return rule.archetype;
    }
  }

  // Default fallback
  return 'melee_dps';
}
```

**Algorithm 3: Cooldown Calculation**
```typescript
function calculateCooldown(abilityPower: number): number {
  // Formula: (power * 2) + 3
  // Power 1: 5 seconds
  // Power 5: 13 seconds
  // Power 10: 23 seconds

  const cooldownSeconds = (abilityPower * 2) + 3;

  // Clamp to reasonable range (5-30 seconds)
  return Math.max(5, Math.min(30, cooldownSeconds));
}
```

---

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. GENERATION REQUEST                                       │
│    - User draws/uploads/types creature                     │
│    - Frontend sends to generation queue                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CLAUDE VISION ANALYSIS                                   │
│    - Analyze visual design                                  │
│    - Extract: race, class, size, armor, weapons             │
│    - Suggest: abilities, animations, archetype              │
│    - Output: ClaudeAnalysisResult                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. STATS ASSIGNMENT SERVICE                                 │
│    - Detect archetype from visual cues                      │
│    - Assign movement speed, attack range, attack speed      │
│    - Balance HP/damage/armor within power budget            │
│    - Output: AssignedCombatStats                            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. ABILITY MATCHER SERVICE                                  │
│    - Match Claude abilities to catalog using keywords       │
│    - Select top 3 by priority                               │
│    - Calculate cooldowns from power ratings                 │
│    - Output: AssignedAbility[]                              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SPRITE GENERATION                                        │
│    - Generate sprites with PixelLab API                     │
│    - Map animations from library                            │
│    - Output: Sprite images + animation frames               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. GENERATION RESULT                                        │
│    - Combine all components:                                │
│      • Claude analysis                                      │
│      • Combat stats (NEW)                                   │
│      • Combat abilities (NEW)                               │
│      • Sprites + animations                                 │
│    - Store in database                                      │
│    - Return to frontend                                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. CREATURE GALLERY/DEPLOYMENT                              │
│    - Display creature with stats in UI                      │
│    - Show: HP, damage, armor, speed, abilities              │
│    - Show: Ability cooldowns, ranges                        │
│    - Player deploys to battlefield                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. COMBAT INITIALIZATION                                    │
│    - Server receives deployment placements                  │
│    - Extract combat stats from each creature                │
│    - Initialize CombatCreature instances                    │
│    - Begin combat simulation with balanced stats            │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependencies

### Depends On

- **Claude Vision API Integration** (L3 - AI Generation Pipeline): Provides initial creature analysis
- **Abilities Catalog** (Config): Central source of truth for ability definitions
- **Generation Queue** (L3 - AI Generation Pipeline): Orchestrates generation pipeline
- **Database Schema**: Stores combat stats with creature records

### Depended On By

- **Combat Animation Controller** (L3 - this epic): Uses abilities to trigger animations
- **Projectile Effect System** (L3 - this epic): Uses attack range/speed for projectile spawning
- **Authoritative Server Simulation** (L2): Uses stats for combat logic (damage calc, movement, cooldowns)
- **Combat UI Overlays** (L3 - this epic): Displays stats, health bars, cooldown indicators

---

## Success Criteria

### MVP Definition of Done

**Functional**:
- [ ] Stats assignment service correctly detects archetype from 5 test creatures (tank, melee_dps, ranged_dps, mage, support)
- [ ] Power budget balancing keeps all creatures within 100-150 point range
- [ ] Movement speed assignment produces logical values (tanks 1-2, DPS 3-4 hexes/sec)
- [ ] Attack range assignment matches weapon type (melee 1 hex, ranged 4-6 hexes)
- [ ] Attack speed assignment scales with archetype (tanks slow, DPS fast)
- [ ] Ability matcher correctly matches 90%+ of Claude abilities to catalog using keywords
- [ ] Top 3 abilities selected by priority, with at least 1 offensive ability
- [ ] Cooldown calculation follows formula: `(power * 2) + 3` seconds
- [ ] Combat stats stored in `GenerationResult` and persisted to database
- [ ] Deployment UI displays creature stats (HP, damage, armor, speed, abilities)
- [ ] Combat engine initializes `CombatCreature` instances with assigned stats

**Non-Functional**:
- [ ] Stats assignment completes in <500ms (part of <60s generation)
- [ ] Abilities catalog supports 50+ ability definitions
- [ ] Semantic matching achieves 90%+ accuracy on test dataset
- [ ] No balance exploits (no 200 HP + 50 damage creatures)
- [ ] Archetype detection is deterministic (same input = same output)

**Testing**:
- [ ] Unit tests for archetype detection (10 test cases covering all archetypes)
- [ ] Unit tests for power budget balancing (edge cases: too low, too high, perfect)
- [ ] Unit tests for ability semantic matching (20 test cases with varied keywords)
- [ ] Unit tests for cooldown calculation (verify formula accuracy)
- [ ] Integration test: full generation pipeline produces valid stats
- [ ] Integration test: stats persist to database correctly
- [ ] E2E test: deployed creature has combat stats available in combat engine

---

## L4 Task Candidates

### Backend Implementation (8 tasks)

1. **TASK-1.1**: Create `StatsAssigner` service with archetype detection algorithm
   - Implement archetype detection from Claude analysis
   - Export `detectArchetype(claudeAnalysis) → string`

2. **TASK-1.2**: Implement movement speed assignment based on archetype
   - Tank: 1-2, Melee DPS: 3-4, Ranged: 2-3, Mage: 2-3, Support: 2-3
   - Export `assignMovementSpeed(archetype) → number`

3. **TASK-1.3**: Implement attack range assignment based on weapon type
   - Parse abilities/class for weapon type (melee/ranged/magic)
   - Export `assignAttackRange(archetype, abilities) → number`

4. **TASK-1.4**: Implement power budget balancing algorithm
   - Calculate current budget: `(HP/10) + damage + (armor*2)`
   - Scale to 100-150 range if needed
   - Export `balanceStatsByBudget(baseStats) → balanced`

5. **TASK-1.5**: Create `AbilityMatcher` service with semantic keyword matching
   - Implement keyword matching algorithm
   - Export `matchAbilities(claudeAbilities) → AbilityDefinition[]`

6. **TASK-1.6**: Implement priority-based ability selection (top 3)
   - Sort by priority, ensure at least 1 offensive
   - Export `selectTopAbilities(matches) → AssignedAbility[]`

7. **TASK-1.7**: Implement cooldown calculation from power rating
   - Formula: `(power * 2) + 3`
   - Export `calculateCooldown(power) → seconds`

8. **TASK-1.8**: Expand abilities catalog to 50+ abilities
   - Add fire, ice, lightning, melee, ranged, defensive, buffs, debuffs
   - Include semantic keywords for each ability

### Integration (4 tasks)

9. **TASK-2.1**: Integrate stats assignment into generation pipeline
   - Call `StatsAssigner` after Claude Vision analysis
   - Store result in `GenerationResult.combatStats`

10. **TASK-2.2**: Integrate ability matching into generation pipeline
    - Call `AbilityMatcher` after Claude Vision analysis
    - Store result in `GenerationResult.combatAbilities`

11. **TASK-2.3**: Update `GenerationResult` type with combat stats fields
    - Add `combatStats: AssignedCombatStats`
    - Add `combatAbilities: AssignedAbility[]`

12. **TASK-2.4**: Update `DeploymentCreature` type with combat stats
    - Add `combatStats` field
    - Add `abilities` field
    - Ensure type compatibility with combat engine

### Prompt Engineering (2 tasks)

13. **TASK-3.1**: Enhance Claude Vision prompt with stat guidance
    - Add power budget explanation
    - Add archetype detection instructions
    - Add ability catalog reference

14. **TASK-3.2**: Create `buildClaudeAbilityGuidance()` helper function
    - Generate formatted ability list from catalog
    - Include in prompt to guide AI toward standard IDs

### Testing (3 tasks)

15. **TASK-4.1**: Write unit tests for `StatsAssigner`
    - Test archetype detection (10 cases)
    - Test power budget balancing (edge cases)
    - Test movement/range/speed assignment

16. **TASK-4.2**: Write unit tests for `AbilityMatcher`
    - Test semantic keyword matching (20 cases)
    - Test priority selection
    - Test cooldown calculation

17. **TASK-4.3**: Write integration test for complete stats assignment pipeline
    - Mock Claude Vision response
    - Verify stats + abilities assigned correctly
    - Verify persistence to database

---

## Metadata

- **Estimated Effort**: 2-3 weeks
- **Team Size**: 1 backend developer
- **Priority**: CRITICAL (required for combat)
- **Risks**: LOW (deterministic algorithms, no external API dependencies beyond Claude Vision)
- **Blockers**: Requires Claude Vision Integration (L3 - AI Generation Pipeline)

---

*This document defines the AI-driven creature stats assignment system. Ready for L4 task implementation.*
