# Creature Animation Studio

**Development Page for Testing Creature Animations and Abilities**

## Overview

The Creature Animation Studio is a dedicated development page that allows you to test and refine creature animations separately from the generation page. This provides a focused environment for experimenting with different animation states and ability effects.

## Access

**URL**: `http://localhost:5175/animation-studio`

## Features

### 1. Load Creatures by Job ID
- Enter a job ID from a completed generation
- Loads complete creature data including:
  - Base sprite
  - Walk animation frames
  - Combat attributes with effect frames
  - Claude analysis metadata

### 2. Animation States

The studio supports three distinct animation states:

#### Idle State
- Displays the creature's base sprite
- Represents the creature standing still
- Always available

#### Walk State
- Cycles through 4-frame walk animation
- Displays at 10 FPS (100ms per frame)
- Shows movement as it would appear in-game
- Only available if walk frames were generated

#### Ability State
- Displays ability effect overlays
- Shows effect sprite composited over base creature
- Uses `mix-blend-mode: screen` for magical glow
- Selectable from list of assigned combat attributes
- Only available if creature has combat attributes

### 3. Playback Controls

- **Play/Pause**: Control animation playback
- **Frame Counter**: Shows current frame and total frames
- **Auto-loop**: Animations loop continuously when playing
- **State Switching**: Automatically pauses and resets when changing states

### 4. Ability Selection

When in Ability state:
- List of all assigned combat attributes
- Shows ability name, damage type, and category
- Displays frame count for each ability
- Click to select different abilities

### 5. Visual Display

- **256x256px viewport** (4x scale from 64x64 original)
- Checkerboard background for transparency visibility
- Pixel-perfect rendering (crisp edges, no blur)
- Real-time state display

### 6. Contextual Information

Each state displays:
- Current animation state
- Frame information
- Playback status
- Creature metadata (concept, race, class, attack type)
- Description of how the animation works

## Usage Workflow

### Step 1: Generate a Creature
```
1. Go to http://localhost:5175/create
2. Generate a creature (e.g., "fire dragon warrior")
3. Note the job ID from the console or network tab
   - Example: Job ID 73
```

### Step 2: Load in Animation Studio
```
1. Navigate to http://localhost:5175/animation-studio
2. Enter the job ID (e.g., "73")
3. Click "Load Creature"
4. Creature data loads with all animations
```

### Step 3: Test Animation States
```
1. Click "Idle" to see base sprite
2. Click "Walk Animation" to see movement
3. Click "Ability Effects" to see combat abilities
4. Use Play/Pause to control playback
5. Select different abilities from the list
```

### Step 4: Iterate and Refine
```
1. Test different creatures to compare animations
2. Verify ability effects composite correctly
3. Check frame timing and smoothness
4. Identify any visual issues
5. Generate new creatures and repeat
```

## Development Use Cases

### 1. Animation Quality Testing
- Verify walk cycles are smooth
- Check ability effects are visible and appropriate
- Test different creature types (melee vs ranged)

### 2. Ability Assignment Validation
- Confirm AI assigned appropriate abilities
- Verify effect frames loaded correctly
- Test ability variety across different creatures

### 3. Visual Debugging
- Inspect sprite compositing
- Check blend modes work correctly
- Verify transparency and layering

### 4. Performance Testing
- Test animation playback at 10 FPS
- Verify no lag or stuttering
- Check memory usage with multiple creatures

### 5. Game Integration Planning
- Visualize how creatures will look in-game
- Plan animation transitions
- Design combat mechanics based on abilities

## Technical Details

### Animation Timing
- **FPS**: 10 frames per second (100ms per frame)
- **Loop**: Continuous loop while playing
- **Reset**: Returns to frame 0 when pausing or switching states

### Sprite Rendering
- **Original Size**: 64x64 pixels
- **Display Size**: 256x256 pixels (4x scale)
- **Rendering**: Pixelated (crisp edges, no interpolation)

### Effect Compositing
- **Method**: CSS `mix-blend-mode: screen`
- **Layering**: Effect sprite overlays base creature sprite
- **Result**: Magical glow effect

### Data Structure
```typescript
interface CreatureData {
  spriteImageBase64: string;           // Base sprite
  walkFrames?: string[];               // 4 walk frames
  combatAttributes?: {
    attributes: CombatAttribute[];     // 1-3 abilities
  };
  baselineAttackType?: 'melee' | 'ranged';
  claudeAnalysis?: {
    concept: string;
    race: string;
    class: string;
  };
}
```

## Example Test Cases

### Test Case 1: Melee Creature
```
Description: "armored knight with sword"
Expected:
- Walk: Heavy, grounded movement
- Abilities: Melee attacks (sword slash, charge)
- Attack Type: melee
```

### Test Case 2: Ranged Creature
```
Description: "wizard with fire magic"
Expected:
- Walk: Light, gliding movement
- Abilities: Ranged spells (fireball, fire breath)
- Attack Type: ranged
```

### Test Case 3: Hybrid Creature
```
Description: "dragon warrior with claws and fire"
Expected:
- Walk: Balanced movement
- Abilities: Mix of melee (claw) and ranged (fire breath)
- Attack Type: melee or ranged (varies)
```

## Comparison with Generation Page

| Feature | Generation Page | Animation Studio |
|---------|----------------|------------------|
| **Purpose** | Create new creatures | Test existing creatures |
| **Display** | All info at once | Focused animation testing |
| **Controls** | Minimal | Full playback controls |
| **State Switching** | Not available | Easy state switching |
| **Ability Selection** | Shows all together | Select individual abilities |
| **Use Case** | Production | Development/Testing |

## Future Enhancements

Potential improvements:

1. **Side-by-side Comparison**
   - Load multiple creatures at once
   - Compare animations side by side

2. **Custom Animation Speeds**
   - Adjust FPS (5, 10, 15, 20)
   - Slow-motion for detailed inspection

3. **Export Options**
   - Export animation as GIF
   - Download sprite sheets
   - Generate animation data JSON

4. **Timeline Scrubber**
   - Manual frame navigation
   - Jump to specific frames
   - Mark important frames

5. **Ability Effect Editor**
   - Adjust blend modes
   - Change opacity
   - Test different composite effects

6. **Movement Simulation**
   - Show creature moving across hex grid
   - Simulate battlefield positioning
   - Test with multiple creatures

7. **Combat Preview**
   - Preview ability activation
   - Show attack ranges
   - Simulate damage effects

## Integration with Game

The Animation Studio helps plan game features:

### Movement System
- Walk animation plays when creature moves
- Speed affects animation timing
- Direction handled by sprite flipping

### Combat System
- Ability effects trigger on attack
- Effect plays over attacker sprite
- Target receives damage on specific frames

### UI Display
- Idle state for unit selection
- Walk preview in unit cards
- Ability icons show effect previews

## Troubleshooting

### Creature Won't Load
**Issue**: "Job is processing, not completed"
**Solution**: Wait for generation to complete, then retry

### No Walk Frames
**Issue**: Walk animation button disabled
**Solution**: Creature may not have walk frames generated (rare)

### No Abilities
**Issue**: Ability effects button disabled
**Solution**: Creature may have no combat attributes (very rare)

### Effect Not Visible
**Issue**: Effect overlay not showing
**Solution**: Check if effectFrames exist in combat attributes

### Animation Stuttering
**Issue**: Playback not smooth
**Solution**: Check browser performance, close other tabs

## Quick Reference

### Keyboard Shortcuts (Future)
- `Space`: Play/Pause
- `1`: Idle state
- `2`: Walk state
- `3`: Ability state
- `←/→`: Previous/Next ability
- `R`: Reset to frame 0

### URLs
- Studio: `/animation-studio`
- Create: `/create`
- Generation: `/generation/:jobId`

---

**Status**: ✅ Fully operational (2025-10-04)
**Purpose**: Development and testing tool for creature animations
**Access**: Local development only (not production feature)
