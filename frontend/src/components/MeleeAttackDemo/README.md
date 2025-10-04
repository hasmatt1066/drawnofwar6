# Melee Attack Demo - Proof of Concept

## Overview

The **MeleeAttackDemo** component validates melee effect compositing - overlaying library attack animations directly on/near the attacker without projectiles.

## Key Differences: Melee vs Ranged

### Melee (this component)
- ✅ Effect overlays **in front of attacker** (fixed offset)
- ✅ No projectile - effect plays once at attack position
- ✅ Hit triggers on **frame 3** (peak of sword swing)
- ✅ Target flashes when hit
- ✅ Effect disappears after 4 frames complete

### Ranged (SpellCastDemo)
- ✅ Effect overlays **on caster** during cast
- ✅ Spawns projectile that **travels to target**
- ✅ Hit triggers when projectile **reaches target position**
- ✅ Projectile animates frames during flight

## Implementation Details

### Animation Used
- **`attack_melee_sword`** - Sword slash arc trail effect
- 4 frames at 10 FPS (400ms total duration)
- Blend mode: `screen` (bright slash effect)

### Positioning Strategy
```typescript
// Attacker at x=100, y=200
// Target at x=350, y=200
// Effect positioned at x=180, y=200 (80px in front of attacker)

EFFECT_OFFSET_X = 80;  // Effect appears between attacker and target
EFFECT_OFFSET_Y = 0;   // Same vertical position
```

### Hit Detection Timing
```typescript
// Frame progression:
// Frame 0: Sword starts swinging
// Frame 1: Sword mid-swing
// Frame 2: Sword approaching peak
// Frame 3: 🎯 SWORD IMPACTS - Trigger target hit
// Frame 4: Follow-through complete

if (nextFrame === 3) {
  triggerTargetHit(); // Flash target, play hit effect
}
```

### Visual Feedback
- **Sword Effect**: Uses `screen` blend mode for bright, visible slash
- **Hit Flash**: Target flashes white for 200ms on impact
- **Animation**: Subtle scale/rotate animation on sword effect

## Usage

```tsx
import { MeleeAttackDemo } from '@/components/MeleeAttackDemo';

<MeleeAttackDemo
  attackerSprite={creatureSprite}      // Base64 creature sprite
  attackerName="Warrior"               // Display name
  targetSprite={enemySprite}           // Base64 enemy sprite (optional)
  targetName="Enemy"                   // Enemy name (optional)
/>
```

## Integration

### Integrated in GenerationProgress
```tsx
{/* After creature generation completes */}
<MeleeAttackDemo
  attackerSprite={result.spriteImageBase64}
  attackerName="Your Creature"
  targetSprite={result.spriteImageBase64}
  targetName="Enemy"
/>
```

## What This Proves

✅ **Melee effects work without projectiles** - Overlay plays at fixed position near attacker
✅ **Frame-based hit detection** - Can trigger game events at specific animation frames
✅ **Effect positioning** - Can place effects at calculated offsets (FRONT, OVERHEAD, etc.)
✅ **Visual feedback** - Target responds to hits with flash/shake effects
✅ **Blend modes work** - `screen` mode creates bright, visible sword slash on any background

## Next Steps

### For Full Game Integration
1. **Dynamic Positioning** - Calculate effect position based on:
   - Attacker facing direction (left/right)
   - Attack type (overhead swing, thrust, uppercut)
   - Creature size (scale offset appropriately)

2. **Multiple Effect Types** - Support other melee effects:
   - `attack_melee_punch` - Impact stars at contact point
   - `attack_melee_claw` - Scratch marks
   - `attack_melee_bite` - Chomp effect

3. **Hit Detection** - Integrate with game engine:
   - Check collision between effect position and target hitbox
   - Apply damage when hit detected
   - Trigger knockback/stun effects

4. **Animation Synchronization** - Sync creature sprite animation with effect:
   - Creature plays attack animation
   - Effect triggers on specific frame of creature animation
   - Both animations complete together

## Files Created

```
frontend/src/components/MeleeAttackDemo/
├── MeleeAttackDemo.tsx           # Main component
├── MeleeAttackDemo.module.css    # Styling (red theme, hit flash)
├── index.ts                      # Exports
└── README.md                     # This file
```

## Demo Features

- **Interactive Button**: Click "Attack!" to trigger sword slash
- **Visual Effect**: Sword slash appears between attacker and target
- **Hit Feedback**: Target flashes white on frame 3 (impact)
- **Debug Panel**: Shows real-time state:
  - Current frame (1-4)
  - Effect position
  - Hit status
  - Blend mode

## Status

✅ **Complete** - Proof of concept validates melee effect compositing strategy

Next: Implement full effect compositing system in game engine (PixiJS) with dynamic positioning, multiple effects, and hit detection.
