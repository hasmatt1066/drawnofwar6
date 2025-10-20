# L3 Feature Specification: Combat UI Feedback

**Feature ID**: `L3-COMBAT-UI-FEEDBACK`
**Parent Epic**: Client Rendering & Animation Sync (L2)
**Status**: SPECIFICATION COMPLETE
**Version**: 1.0
**Last Updated**: 2025-10-05

---

## Overview

Implement visual and UI feedback systems that communicate combat events to players in real-time. This includes floating damage numbers, health bars rendered in PixiJS, screen shake effects, hit flashes, and a combat log rendered in HTML overlay. The feedback system prioritizes clarity and readability while maintaining performance at 60 FPS with multiple simultaneous effects.

**User Value**: Players can quickly understand what's happening in combat without needing to study unit stats. Damage numbers show impact magnitude, health bars show survivability, screen shake emphasizes big moments, and combat log provides detailed event history.

**Technical Value**: Separates rendering concerns (PixiJS for health bars, HTML for combat log), optimizes effect spawning with object pooling, and provides extensible architecture for future feedback types (buff icons, status effects, etc.).

---

## Functional Requirements

### FR-1: Floating Damage Numbers
**Description**: When a unit takes damage, display floating damage number that rises and fades.

**Behavior**:
- **Trigger**: Server event `unitDamaged` with `{ unitId, damage, damageType }`
- **Display Threshold**: Only show damage numbers for damage ≥ 5 (skip small hits to reduce clutter)
- **Position**: Spawn above damaged unit's sprite (offset +30px Y from sprite center)
- **Animation**: Rise 60px over 1.2 seconds, fade out over last 0.4 seconds
- **Font**: Bold 24px monospace, white with black outline (2px stroke)
- **Color Coding**:
  - Physical damage: White (#FFFFFF)
  - Fire/magic damage: Orange (#FF6600)
  - Critical hits: Yellow (#FFFF00) with larger font (32px)
  - Healing: Green (#00FF00)
- **Offset Pattern**: If multiple damage numbers spawn on same unit within 500ms, offset horizontally in spiral pattern (±30px X, ±15px Y)
- **Size Scaling**: Base damage 5-20 = 24px font, 21-50 = 28px, 51+ = 32px
- **Max Simultaneous**: Limit 20 damage numbers on screen (despawn oldest if exceeded)

**Edge Cases**:
- If unit dies during damage number animation, complete animation before despawning
- If unit moves, damage number stays at spawn position (doesn't follow unit)
- If multiple hits occur simultaneously (AOE), spawn all numbers with spiral offset
- If damage is 0 (attack blocked/dodged), show "MISS" in gray instead of number

**Acceptance Criteria**:
- Damage numbers appear above damaged units
- Numbers rise and fade over 1.2 seconds
- Only damage ≥ 5 shown
- Color-coded by damage type
- Size scaled by damage magnitude
- Spiral offset for multiple simultaneous hits
- Max 20 simultaneous numbers enforced

---

### FR-2: Health Bars (PixiJS Rendering)
**Description**: Render health bars above each creature sprite showing current/max HP.

**Behavior**:
- **Position**: 40px above creature sprite center
- **Size**: 60px wide × 6px tall
- **Background**: Dark gray (#333333) with black border (1px)
- **Foreground**: Gradient from green (#00FF00) at full HP to red (#FF0000) at 0 HP
- **Update Frequency**: Interpolate smoothly over 200ms when health changes (no instant jumps)
- **Visibility**: Always visible during combat, hidden during deployment phase
- **Team Indicator**: Thin 2px border in team color (blue for player, red for opponent)
- **HP Text**: Show "45/100" in small 10px font centered on bar (optional, can be toggled in settings)
- **Damage Flash**: On damage taken, briefly flash white for 100ms then return to gradient

**Calculations**:
```typescript
// Health bar fill width
const fillWidth = (currentHP / maxHP) * barWidth;

// Color gradient (green → yellow → red)
const hpPercent = currentHP / maxHP;
if (hpPercent > 0.5) {
  // Green to yellow: lerp between green (#00FF00) and yellow (#FFFF00)
  color = lerpColor(0x00FF00, 0xFFFF00, (1 - hpPercent) * 2);
} else {
  // Yellow to red: lerp between yellow (#FFFF00) and red (#FF0000)
  color = lerpColor(0xFFFF00, 0xFF0000, (0.5 - hpPercent) * 2);
}
```

**Edge Cases**:
- If creature dies, fade health bar out over death animation duration
- If HP exceeds max HP (overheal/buff), clamp bar at 100% width, show "+X" indicator
- If creature off-screen, don't render health bar (frustum culling)
- If zoomed out < 0.7x, reduce health bar size to 40px × 4px (LOD)

**Acceptance Criteria**:
- Health bars render above all creatures
- Bars update smoothly over 200ms
- Color gradient green → yellow → red based on HP%
- Team color border (blue/red)
- Damage flash effect on HP reduction
- Fade out on death
- LOD scaling at low zoom

---

### FR-3: Screen Shake Effects
**Description**: Camera shakes briefly on big combat events (AOE abilities, deaths, critical hits).

**Behavior**:
- **Always Trigger**:
  - AOE ability impacts (any AOE, regardless of damage)
  - Unit deaths (any unit)
- **Conditionally Trigger**:
  - Damage > 30% of unit's max HP (big hit)
- **Shake Pattern**: Randomized offset in 8 directions (N, NE, E, SE, S, SW, W, NW)
- **Shake Magnitude**:
  - Normal shake (big hit): 5px radius, 200ms duration
  - Strong shake (AOE): 8px radius, 300ms duration
  - Death shake: 6px radius, 250ms duration
- **Easing**: Exponential decay (strong at start, gentle at end)
- **Frequency Limit**: Max 1 shake per 500ms (if multiple events trigger simultaneously, use strongest shake)
- **User Setting**: "Screen Shake Intensity" slider (0% = disabled, 50% = half magnitude, 100% = full)

**Shake Implementation**:
```typescript
class ScreenShakeEffect {
  private startTime: number;
  private duration: number;
  private magnitude: number;

  update(deltaTime: number): { x: number, y: number } {
    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1.0);

    // Exponential decay
    const intensity = (1 - progress) ** 2;

    // Random offset in 8 directions
    const angle = Math.random() * Math.PI * 2;
    const offsetX = Math.cos(angle) * this.magnitude * intensity;
    const offsetY = Math.sin(angle) * this.magnitude * intensity;

    return { x: offsetX, y: offsetY };
  }
}
```

**Edge Cases**:
- If camera is manually panning during shake, blend shake offset with pan (don't cancel pan)
- If multiple shakes triggered within 500ms window, queue and play sequentially
- If screen shake disabled in settings, skip all shake logic (no performance cost)

**Acceptance Criteria**:
- Screen shakes on AOE impacts
- Screen shakes on unit deaths
- Screen shakes on damage > 30% max HP
- Max 1 shake per 500ms
- Exponential decay easing
- User setting slider (0-100%)
- No interference with manual camera control

---

### FR-4: Hit Flash Effect
**Description**: When a unit takes damage, briefly flash the sprite white/red to indicate impact.

**Behavior**:
- **Trigger**: Server event `unitDamaged`
- **Flash Color**: White (#FFFFFF) at 50% opacity
- **Duration**: 100ms total (50ms flash white, 50ms fade back to normal)
- **Implementation**: Apply color tint to PIXI.Sprite
- **Multiple Hits**: If unit hit again during flash, restart flash (don't stack)
- **Death Exception**: On death, flash red (#FF0000) for 200ms before death animation

**PixiJS Implementation**:
```typescript
function applyHitFlash(sprite: PIXI.Sprite, isDeath: boolean = false) {
  const flashColor = isDeath ? 0xFF0000 : 0xFFFFFF;
  const flashDuration = isDeath ? 200 : 100;

  sprite.tint = flashColor;

  setTimeout(() => {
    sprite.tint = 0xFFFFFF; // Reset to normal
  }, flashDuration);
}
```

**Edge Cases**:
- If unit dies during hit flash, override with death flash (red, 200ms)
- If unit takes multiple hits in rapid succession, only show flash for most recent hit
- If unit off-screen (frustum culled), skip flash (no performance cost)

**Acceptance Criteria**:
- Sprite flashes white on damage
- Flash duration 100ms
- Death flash red, 200ms
- Multiple hits restart flash
- No stacking tints

---

### FR-5: Combat Log (HTML Overlay)
**Description**: Scrolling text feed of major combat events, rendered in HTML overlay above PixiJS canvas.

**Behavior**:
- **Position**: Bottom-right corner of viewport, 400px wide × 300px tall
- **Events Logged**:
  - Damage dealt: "Knight dealt 25 damage to Goblin"
  - Deaths: "Goblin has fallen!"
  - Abilities used: "Mage cast Fireball at (5, 3)"
  - Healing: "Cleric healed Knight for 15 HP"
  - Status effects: "Goblin is stunned for 2 turns"
- **Entry Format**:
  - Timestamp: "[12:34]" in gray
  - Event text: Color-coded by type
  - Auto-scroll: New entries appear at bottom, scroll up
- **Color Coding**:
  - Damage: Red (#FF4444)
  - Healing: Green (#44FF44)
  - Abilities: Blue (#4444FF)
  - Deaths: Dark red (#AA0000)
  - Status effects: Yellow (#FFFF44)
- **Max Entries**: 50 entries (remove oldest when exceeded)
- **Auto-Hide**: Fade to 50% opacity when no new entries for 5 seconds
- **User Setting**: Toggle "Show Combat Log" (default: ON)

**Auto-Scroll Implementation** (CRITICAL):
- **MUST use `element.scrollTop`**, NOT `element.scrollIntoView()`
- `scrollIntoView()` scrolls the entire page, making battlefield inaccessible
- `scrollTop` only scrolls the log container internally

```typescript
// CORRECT Implementation:
if (autoScroll && logContainerRef.current) {
  logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
}

// INCORRECT - DO NOT USE:
if (autoScroll && logEndRef.current) {
  logEndRef.current.scrollIntoView({ behavior: 'smooth' }); // Scrolls entire page!
}
```

**Why This Matters**:
- Combat log updates 10 times per second during combat
- If using `scrollIntoView()`, page scrolls to bottom continuously
- User cannot access battlefield at top of page
- Page fights user scroll attempts

**Fix Date**: 2025-10-20 - CombatLogPanel.tsx updated to use scrollTop
**Related Report**: /docs/implementation-reports/MULTIPLAYER_COMBAT_BUG_FIXES.md

**HTML Structure**:
```html
<div class="combat-log" style="
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 400px;
  height: 300px;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid #666;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
  padding: 10px;
">
  <div class="log-entry">
    <span class="timestamp">[12:34]</span>
    <span class="event-text" style="color: #FF4444;">Knight dealt 25 damage to Goblin</span>
  </div>
  <!-- More entries... -->
</div>
```

**Edge Cases**:
- If multiple events occur simultaneously, log in order: deaths → damage → abilities → healing
- If combat log disabled, don't render HTML element (save DOM nodes)
- If viewport resized, reposition combat log to maintain bottom-right alignment

**Acceptance Criteria**:
- Combat log renders in bottom-right corner
- All major events logged (damage, deaths, abilities, healing, status)
- Color-coded entries
- Auto-scroll on new entries
- Max 50 entries
- Auto-fade after 5 seconds of inactivity
- Toggleable in settings

---

### FR-6: Effect Pooling & Performance
**Description**: Optimize effect spawning (damage numbers, flashes, shakes) with object pooling to prevent garbage collection stutters.

**Behavior**:
- **Damage Number Pool**: Pre-allocate 50 PIXI.Text objects, reuse when damage numbers despawn
- **Health Bar Pool**: Pre-allocate 20 PIXI.Graphics objects (max 16 creatures + 4 spare)
- **Effect Cleanup**: Despawn completed effects immediately (no orphaned sprites)
- **Performance Target**: Maintain 60 FPS with 20 simultaneous damage numbers + 16 health bars + screen shake

**Pooling Implementation**:
```typescript
class DamageNumberPool {
  private pool: PIXI.Text[] = [];
  private active: Set<PIXI.Text> = new Set();

  constructor(poolSize: number) {
    for (let i = 0; i < poolSize; i++) {
      const text = new PIXI.Text('', {
        fontSize: 24,
        fontFamily: 'monospace',
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 2
      });
      this.pool.push(text);
    }
  }

  spawn(damage: number, position: { x: number, y: number }): PIXI.Text {
    let text = this.pool.pop();
    if (!text) {
      // Pool exhausted, create new (should be rare)
      text = new PIXI.Text('', { /* ... */ });
    }

    text.text = damage.toString();
    text.position.set(position.x, position.y);
    this.active.add(text);

    return text;
  }

  despawn(text: PIXI.Text): void {
    this.active.delete(text);
    this.pool.push(text);
  }
}
```

**Acceptance Criteria**:
- Damage number pool pre-allocated (50 objects)
- Health bar pool pre-allocated (20 objects)
- Completed effects despawned immediately
- No garbage collection stutters during combat
- 60 FPS maintained with 20 simultaneous effects

---

## Technical Architecture

### Components

**DamageNumberRenderer** (`frontend/src/components/BattlefieldEffects/DamageNumberRenderer.ts`)
- Spawn damage numbers on `unitDamaged` event
- Animate rise + fade over 1.2 seconds
- Spiral offset pattern for multiple simultaneous hits
- Color coding and size scaling based on damage type/magnitude
- Object pooling for PIXI.Text objects

**HealthBarRenderer** (`frontend/src/components/BattlefieldEffects/HealthBarRenderer.ts`)
- Create PIXI.Graphics health bar for each creature
- Update health bar fill width + gradient color on HP change
- Smooth interpolation over 200ms
- Damage flash effect (white, 100ms)
- LOD scaling based on zoom level
- Object pooling for PIXI.Graphics objects

**ScreenShakeController** (`frontend/src/components/BattlefieldEffects/ScreenShakeController.ts`)
- Listen to combat events (AOE, deaths, big hits)
- Apply randomized camera offset (8-directional shake)
- Exponential decay easing
- Frequency limiting (max 1 per 500ms)
- User setting multiplier (0-100%)

**HitFlashEffect** (`frontend/src/components/BattlefieldEffects/HitFlashEffect.ts`)
- Apply white/red tint to PIXI.Sprite on damage
- 100ms duration (white), 200ms for death (red)
- Restart flash on multiple hits (don't stack)

**CombatLogRenderer** (`frontend/src/components/BattlefieldEffects/CombatLogRenderer.tsx`)
- React component, HTML overlay above PixiJS canvas
- Listen to combat events
- Format and color-code log entries
- Auto-scroll, auto-fade, max 50 entries
- Toggleable in settings

**EffectPoolManager** (`frontend/src/components/BattlefieldEffects/EffectPoolManager.ts`)
- Pre-allocate object pools (damage numbers, health bars)
- Spawn/despawn logic with pool reuse
- Track active effects
- Cleanup completed effects

---

### Integration with Event System

**Event Flow**:
```
Server → WebSocket → StateUpdateProcessor → EventQueue → Effect Renderers

Example: Unit Damaged Event
1. Server sends: { type: 'unitDamaged', unitId: 'unit-123', damage: 25, damageType: 'physical' }
2. StateUpdateProcessor receives event, adds to EventQueue
3. EventQueue dispatches to all effect renderers:
   - DamageNumberRenderer: Spawn floating "-25" above unit
   - HealthBarRenderer: Update health bar, trigger damage flash
   - HitFlashEffect: Flash unit sprite white for 100ms
   - ScreenShakeController: Check if damage > 30% max HP, shake if yes
   - CombatLogRenderer: Add entry "Knight dealt 25 damage to Goblin"
```

---

### Data Structures

**Damage Number**
```typescript
interface DamageNumber {
  id: string;
  damage: number;
  damageType: 'physical' | 'fire' | 'magic' | 'healing';
  isCritical: boolean;
  position: { x: number, y: number }; // Spawn position (world coords)
  spawnTime: number; // timestamp
  duration: number; // 1200ms
  sprite: PIXI.Text;
}
```

**Health Bar**
```typescript
interface HealthBar {
  unitId: string;
  currentHP: number;
  maxHP: number;
  renderHP: number; // Interpolated for smooth update
  position: { x: number, y: number }; // Above creature sprite
  graphics: PIXI.Graphics;
  teamColor: number; // 0x0000FF (blue) or 0xFF0000 (red)
  lastFlashTime: number; // timestamp of last damage flash
}
```

**Screen Shake**
```typescript
interface ScreenShake {
  id: string;
  startTime: number;
  duration: number; // 200-300ms
  magnitude: number; // 5-8px
  easing: (progress: number) => number; // Exponential decay
}
```

**Combat Log Entry**
```typescript
interface CombatLogEntry {
  id: string;
  timestamp: string; // "[12:34]"
  eventType: 'damage' | 'death' | 'ability' | 'healing' | 'status';
  text: string; // "Knight dealt 25 damage to Goblin"
  color: string; // CSS color
}
```

---

## Dependencies

### Depends On
- **State Update Processor** (L3): Provides combat events
- **Event Queue Manager** (L3): Queues events for effect renderers
- **PixiJS Battlefield Renderer** (L3): Health bars rendered on PixiJS stage
- **Creature Sprite Layer** (L3): Damage numbers positioned relative to sprites

### Depended On By
- **Multi-Round Battle System** (L2): Players rely on feedback to understand combat flow
- **Ability System** (L3): Ability impact communicated through damage numbers and effects

---

## Success Criteria

### MVP Definition of Done
- [ ] Damage numbers appear above damaged units (damage ≥ 5)
- [ ] Damage numbers rise and fade over 1.2 seconds
- [ ] Damage numbers color-coded (white, orange, yellow, green)
- [ ] Damage numbers size-scaled by magnitude
- [ ] Spiral offset for multiple simultaneous hits
- [ ] Max 20 simultaneous damage numbers enforced
- [ ] Health bars render above all creatures in PixiJS
- [ ] Health bars update smoothly over 200ms
- [ ] Health bars gradient green → yellow → red
- [ ] Health bars flash white on damage (100ms)
- [ ] Health bars fade out on death
- [ ] Screen shake triggers on AOE impacts
- [ ] Screen shake triggers on unit deaths
- [ ] Screen shake triggers on big hits (>30% max HP)
- [ ] Screen shake limited to max 1 per 500ms
- [ ] Screen shake intensity adjustable in settings
- [ ] Hit flash effect (white, 100ms) on damage
- [ ] Death flash effect (red, 200ms) on death
- [ ] Combat log renders in bottom-right corner
- [ ] Combat log shows all major events (damage, deaths, abilities)
- [ ] Combat log color-coded by event type
- [ ] Combat log auto-scrolls and auto-fades
- [ ] Combat log toggleable in settings
- [ ] Object pooling for damage numbers (50 pool size)
- [ ] Object pooling for health bars (20 pool size)
- [ ] 60 FPS maintained with 20 simultaneous effects

### Exceptional Targets (Post-MVP)
- [ ] Buff/debuff icons above creatures (overlay on health bar)
- [ ] Status effect timers (circular countdown indicators)
- [ ] Critical hit particle burst (star particles)
- [ ] Minimap in corner with unit positions
- [ ] Damage recap graph (DPS over time chart)
- [ ] Kill feed (right side, recent deaths)

---

## L4 Task Candidates

### Phase 1: Damage Numbers (4 tasks)
- **L4-UI-001**: Implement `DamageNumberPool` with object pooling
  - Pre-allocate 50 PIXI.Text objects
  - Spawn/despawn with pool reuse
  - Test pool exhaustion handling

- **L4-UI-002**: Implement `DamageNumberRenderer` spawn logic
  - Listen to `unitDamaged` events
  - Create damage number at unit position (+30px Y offset)
  - Color coding and size scaling based on damage/type
  - Spiral offset pattern for simultaneous hits

- **L4-UI-003**: Implement damage number animation (rise + fade)
  - Rise 60px over 1.2 seconds
  - Fade alpha 1.0 → 0.0 over last 0.4 seconds
  - Despawn and return to pool on completion

- **L4-UI-004**: Implement damage threshold and max simultaneous limit
  - Only spawn if damage ≥ 5
  - Enforce max 20 simultaneous numbers
  - Despawn oldest if exceeded

### Phase 2: Health Bars (4 tasks)
- **L4-UI-005**: Implement `HealthBarRenderer` with PIXI.Graphics
  - Create health bar for each creature
  - Position 40px above sprite
  - Background (dark gray) + foreground (gradient)
  - Team color border (blue/red)

- **L4-UI-006**: Implement health bar color gradient (green → yellow → red)
  - Calculate gradient based on HP%
  - Lerp between colors
  - Update on HP change

- **L4-UI-007**: Implement smooth HP interpolation (200ms)
  - Interpolate renderHP toward currentHP
  - Update fill width each frame
  - Damage flash effect (white, 100ms)

- **L4-UI-008**: Implement health bar LOD and death fade
  - Scale bar size based on zoom level
  - Fade out over death animation duration
  - Frustum culling (don't render off-screen)

### Phase 3: Screen Shake & Hit Flash (3 tasks)
- **L4-UI-009**: Implement `ScreenShakeController` with event triggers
  - Listen to AOE, death, big hit events
  - Calculate shake magnitude (5-8px)
  - Frequency limiting (max 1 per 500ms)

- **L4-UI-010**: Implement screen shake animation (randomized offset)
  - 8-directional random offset
  - Exponential decay easing
  - Apply offset to camera position
  - User setting multiplier (0-100%)

- **L4-UI-011**: Implement `HitFlashEffect` sprite tinting
  - Apply white tint on damage (100ms)
  - Apply red tint on death (200ms)
  - Restart flash on multiple hits (no stacking)

### Phase 4: Combat Log (3 tasks)
- **L4-UI-012**: Create `CombatLogRenderer` React component
  - HTML overlay in bottom-right corner
  - Scrollable container (400px × 300px)
  - Background, border, font styling

- **L4-UI-013**: Implement combat log event formatting
  - Listen to damage, death, ability, healing events
  - Format entries with timestamp + color-coded text
  - Auto-scroll on new entries

- **L4-UI-014**: Implement combat log max entries and auto-fade
  - Max 50 entries (remove oldest)
  - Auto-fade to 50% opacity after 5 seconds
  - Toggleable in settings

### Phase 5: Testing & Polish (3 tasks)
- **L4-UI-015**: Unit tests for damage number calculations
  - Color coding logic
  - Size scaling logic
  - Spiral offset pattern

- **L4-UI-016**: Integration tests with PixiJS renderer
  - Spawn 20 simultaneous damage numbers
  - Update 16 health bars
  - Trigger screen shake
  - Measure FPS (must be 60+)

- **L4-UI-017**: Create UI feedback settings panel
  - Screen shake intensity slider (0-100%)
  - Toggle combat log
  - Toggle damage numbers
  - Toggle health bar HP text

**Total: 17 tasks**

---

## Open Questions & Clarifications

### Q1: Damage Number Spiral Offset Pattern
**Question**: Should spiral offset be clockwise or randomized?

**Options**:
- **Clockwise spiral**: Predictable, but may look mechanical
- **Randomized offset**: More organic, but may overlap

**Recommendation**: Randomized offset within spiral bounds (±30px X, ±15px Y), with collision detection to prevent overlaps.

---

### Q2: Health Bar HP Text Visibility
**Question**: Should HP text ("45/100") always show, or only on hover/selection?

**Options**:
- **Always show**: More information, but clutters screen
- **Hover/selection only**: Cleaner, but requires interaction

**Recommendation**: Make it toggleable in settings (default: OFF for clean look, ON for hardcore players).

---

### Q3: Screen Shake Frequency Limit Window
**Question**: Should 500ms frequency limit be global (any shake) or per-type (separate limits for AOE, deaths, big hits)?

**Options**:
- **Global**: Simpler logic, prevents all shake spam
- **Per-type**: More nuanced, but complex

**Recommendation**: Global 500ms limit (as specified), simpler and prevents overwhelming shake.

---

### Q4: Combat Log Auto-Hide Behavior
**Question**: Should combat log auto-hide completely or just fade to 50% opacity?

**Options**:
- **Auto-hide**: Cleaner, but must reopen to see history
- **Fade to 50%**: Still visible, but less intrusive

**Recommendation**: Fade to 50% opacity (as specified), preserves visibility without distraction.

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Too many damage numbers clutter screen | High | Medium | Enforce max 20 limit, threshold ≥ 5, spiral offset |
| Screen shake causes motion sickness | High | Low | Make intensity adjustable (0-100%), default to moderate |
| Health bar performance with 16+ creatures | Medium | Low | Object pooling, frustum culling, LOD at low zoom |
| Combat log DOM updates impact FPS | Medium | Medium | Batch updates, throttle to 1 update per 100ms |
| Damage numbers desync from server events | Medium | Low | Use buffered event queue, not real-time WebSocket stream |

---

## Metadata

- **Estimated Effort**: 2-3 weeks
- **Dependencies**: State Update Processor, PixiJS Renderer, Event Queue
- **Priority**: HIGH (critical for combat clarity)
- **Complexity**: MEDIUM (rendering + pooling + event handling)

---

**Status**: Ready for L4 task breakdown and implementation
**Next Steps**: Review open questions, then proceed to task implementation
