# L3-FEATURE: Drag-and-Drop Placement Controller

**Feature ID**: `drag-drop-placement-controller`
**Epic**: Hex Grid Deployment System (L2)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

---

## Feature Summary

A mouse and touch-enabled drag-and-drop controller that allows players to place creatures on the hex grid through intuitive drag-from-roster-to-hex interactions. Handles both mouse and touch input, provides visual feedback during dragging, validates placement in real-time, and manages creature repositioning and removal.

**Value Proposition**: Enables frictionless creature placement with clear visual feedback, eliminating ambiguity about where creatures will be placed and ensuring accessibility across desktop and mobile devices.

---

## User Value

**For Players**: Natural drag-and-drop interaction that works like moving pieces on a board game - grab a creature, see where it can go, drop it in place. No clicks, no menus, just direct manipulation.

**For Developers**: Unified input handling across mouse and touch, separation of input logic from rendering, testable placement state machine.

---

## Functional Requirements

### Drag Initiation

1. **Mouse Drag**
   - **Trigger**: Mouse down on creature in roster
   - **Visual**: Creature follows cursor, 60% opacity
   - **Cursor**: Changes to "grabbing" hand icon
   - **Cancel**: ESC key or mouse up outside grid

2. **Touch Drag**
   - **Trigger**: Long press (300ms) on creature
   - **Visual**: Creature lifts with scale animation (1.0 → 1.1)
   - **Haptic**: Vibration feedback (if available)
   - **Cancel**: Touch up outside grid

3. **Drag Constraints**
   - Only one creature dragging at a time
   - Cannot drag opponent's creatures
   - Cannot drag locked creatures (after Ready)
   - Cannot drag from empty roster slot

### Drag Tracking

1. **Position Updates**
   - **Frequency**: 60fps (every frame)
   - **Smoothing**: Linear interpolation (no lag)
   - **Bounds**: Creature sprite stays within viewport
   - **Snap**: No snapping during drag, free movement

2. **Hover Detection**
   - **Hex Detection**: Convert cursor position to hex coordinate
   - **Update Rate**: Every 16ms (60fps)
   - **Validation**: Check if hex is valid placement
   - **Visual Feedback**: Highlight target hex (green/red)

3. **Preview Rendering**
   - **Ghost Sprite**: Semi-transparent creature at cursor
   - **Range Indicator**: Optional attack range preview
   - **Orientation**: Face toward enemy deployment zone
   - **Layer**: Render above grid, below cursor

### Drop Validation

1. **Valid Drop Conditions**
   - Hex is within player's deployment zone
   - Hex is not already occupied
   - Hex is within grid bounds
   - Player has not clicked Ready

2. **Invalid Drop Conditions**
   - Hex is in opponent's zone → Show error tooltip
   - Hex is in neutral zone → Show error tooltip
   - Hex is occupied → Show red X icon
   - Hex is out of bounds → Snap back to roster

3. **Drop Actions**
   - **Valid Drop**: Place creature, update state, play sound
   - **Invalid Drop**: Shake animation, error message, snap back
   - **Cancel Drop**: Return to roster (ESC or drop outside grid)

### Creature Repositioning

1. **Reposition Drag**
   - **Trigger**: Drag already-placed creature
   - **Removal**: Remove from current hex (temporary)
   - **Placement**: Drop on new valid hex
   - **Cancel**: ESC returns to original hex

2. **Swap Functionality** (Optional)
   - **Trigger**: Drag creature onto occupied hex
   - **Action**: Swap positions if both in same zone
   - **Visual**: Both creatures animate to new positions
   - **Validation**: Ensure swap doesn't violate rules

3. **Removal Drag**
   - **Trigger**: Drag placed creature back to roster
   - **Action**: Remove from grid, return to unplaced state
   - **Visual**: Creature fades from hex, appears in roster
   - **Counter**: Update "X/8 placed" counter

### Multi-Input Support

1. **Mouse + Keyboard**
   - **Drag**: Mouse down + move + mouse up
   - **Cancel**: ESC key during drag
   - **Modifier Keys**: Shift for range preview
   - **Right Click**: Context menu (cancel drag)

2. **Touch**
   - **Drag**: Long press + move + release
   - **Cancel**: Touch up outside grid
   - **Multi-Touch**: Ignore second finger (prevent zoom)
   - **Scroll Prevention**: Prevent page scroll during drag

3. **Gamepad** (Post-MVP)
   - **Selection**: D-pad to highlight creature
   - **Placement**: A button to pick up, move with D-pad, A to drop
   - **Cancel**: B button

---

## Technical Specification

### Architecture

**Component Structure**
```typescript
/**
 * Main drag-and-drop controller
 */
class DragDropController {
  private dragState: DragState;
  private inputHandler: InputHandler;
  private validationService: PlacementValidator;
  private renderer: HexGridRenderer;

  constructor(config: DragDropConfig);

  // Input handlers
  onMouseDown(event: MouseEvent): void;
  onMouseMove(event: MouseEvent): void;
  onMouseUp(event: MouseEvent): void;
  onTouchStart(event: TouchEvent): void;
  onTouchMove(event: TouchEvent): void;
  onTouchEnd(event: TouchEvent): void;

  // State management
  startDrag(creature: Creature): void;
  updateDrag(position: PixelCoordinate): void;
  endDrag(hex: AxialCoordinate | null): void;
  cancelDrag(): void;
}

/**
 * Drag state machine
 */
interface DragState {
  phase: 'idle' | 'dragging' | 'validating' | 'dropping';
  creature: Creature | null;
  sourceHex: AxialCoordinate | null; // If repositioning
  currentPosition: PixelCoordinate | null;
  targetHex: AxialCoordinate | null;
  isValid: boolean;
}

/**
 * Input handler abstraction (mouse + touch)
 */
class InputHandler {
  enableMouseInput(): void;
  enableTouchInput(): void;
  disableInput(): void;

  // Normalize events
  getPointerPosition(event: MouseEvent | TouchEvent): PixelCoordinate;
  isLongPress(startTime: number, currentTime: number): boolean;
}

/**
 * Placement validator
 */
interface PlacementValidator {
  isValidPlacement(hex: AxialCoordinate, creature: Creature): ValidationResult;
  getValidationMessage(result: ValidationResult): string;
}

interface ValidationResult {
  valid: boolean;
  reason?: 'occupied' | 'out_of_zone' | 'out_of_bounds' | 'locked';
}
```

**Drag State Machine**
```typescript
class DragDropController {
  private dragState: DragState = {
    phase: 'idle',
    creature: null,
    sourceHex: null,
    currentPosition: null,
    targetHex: null,
    isValid: false
  };

  /**
   * Start drag operation
   */
  startDrag(creature: Creature, sourceHex?: AxialCoordinate): void {
    if (this.dragState.phase !== 'idle') {
      throw new Error('Cannot start drag while another drag is active');
    }

    this.dragState = {
      phase: 'dragging',
      creature,
      sourceHex: sourceHex || null,
      currentPosition: null,
      targetHex: null,
      isValid: false
    };

    // Visual feedback
    this.renderer.setCursor('grabbing');
    this.playSoundEffect('pickup');

    // If repositioning, remove from current hex
    if (sourceHex) {
      this.removeCreatureFromGrid(creature, sourceHex);
    }
  }

  /**
   * Update drag position (called every frame)
   */
  updateDrag(position: PixelCoordinate): void {
    if (this.dragState.phase !== 'dragging') return;

    this.dragState.currentPosition = position;

    // Convert position to hex
    const hex = this.hexMath.pixelToHex(position);

    // Validate placement
    const validation = this.validationService.isValidPlacement(hex, this.dragState.creature!);
    this.dragState.targetHex = hex;
    this.dragState.isValid = validation.valid;

    // Update visual feedback
    this.renderer.updateDragPreview(position, this.dragState.creature!);
    this.renderer.updateHighlight(
      hex,
      validation.valid ? HighlightState.VALID : HighlightState.INVALID
    );
  }

  /**
   * End drag operation (drop or cancel)
   */
  endDrag(dropPosition: PixelCoordinate | null): void {
    if (this.dragState.phase !== 'dragging') return;

    if (!dropPosition) {
      this.cancelDrag();
      return;
    }

    const hex = this.hexMath.pixelToHex(dropPosition);
    const validation = this.validationService.isValidPlacement(hex, this.dragState.creature!);

    if (validation.valid) {
      // Valid drop
      this.placeCreature(this.dragState.creature!, hex);
      this.playSoundEffect('place_success');
      this.renderer.playPlacementAnimation(hex, this.dragState.creature!);
    } else {
      // Invalid drop
      this.playSoundEffect('place_failure');
      this.renderer.playErrorAnimation(hex, validation.reason!);

      // Snap back to original position
      if (this.dragState.sourceHex) {
        this.placeCreature(this.dragState.creature!, this.dragState.sourceHex);
      } else {
        this.returnToRoster(this.dragState.creature!);
      }
    }

    // Reset state
    this.dragState = { phase: 'idle', creature: null, sourceHex: null, currentPosition: null, targetHex: null, isValid: false };
    this.renderer.clearHighlights();
    this.renderer.setCursor('default');
  }

  /**
   * Cancel drag (ESC key or touch up outside)
   */
  cancelDrag(): void {
    if (this.dragState.phase === 'idle') return;

    // Return creature to original position
    if (this.dragState.sourceHex) {
      this.placeCreature(this.dragState.creature!, this.dragState.sourceHex);
    } else {
      this.returnToRoster(this.dragState.creature!);
    }

    this.playSoundEffect('cancel');
    this.dragState = { phase: 'idle', creature: null, sourceHex: null, currentPosition: null, targetHex: null, isValid: false };
    this.renderer.clearHighlights();
    this.renderer.setCursor('default');
  }
}
```

**Input Event Handling**
```typescript
class InputHandler {
  private longPressTimer: number | null = null;
  private longPressThreshold = 300; // ms

  /**
   * Mouse down - start drag immediately
   */
  handleMouseDown(event: MouseEvent, creature: Creature): void {
    event.preventDefault();
    const position = { x: event.clientX, y: event.clientY };
    this.controller.startDrag(creature);
    this.controller.updateDrag(position);
  }

  /**
   * Mouse move - update drag position
   */
  handleMouseMove(event: MouseEvent): void {
    if (this.controller.isDragging()) {
      const position = { x: event.clientX, y: event.clientY };
      this.controller.updateDrag(position);
    }
  }

  /**
   * Mouse up - end drag
   */
  handleMouseUp(event: MouseEvent): void {
    if (this.controller.isDragging()) {
      const position = { x: event.clientX, y: event.clientY };
      this.controller.endDrag(position);
    }
  }

  /**
   * Touch start - wait for long press
   */
  handleTouchStart(event: TouchEvent, creature: Creature): void {
    event.preventDefault();
    const touch = event.touches[0];
    const position = { x: touch.clientX, y: touch.clientY };

    // Start long press timer
    this.longPressTimer = window.setTimeout(() => {
      this.controller.startDrag(creature);
      this.controller.updateDrag(position);
      this.vibrate(50); // Haptic feedback
    }, this.longPressThreshold);
  }

  /**
   * Touch move - update drag if active
   */
  handleTouchMove(event: TouchEvent): void {
    event.preventDefault();

    if (this.longPressTimer) {
      // Cancel long press if moved before threshold
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.controller.isDragging()) {
      const touch = event.touches[0];
      const position = { x: touch.clientX, y: touch.clientY };
      this.controller.updateDrag(position);
    }
  }

  /**
   * Touch end - end drag or cancel
   */
  handleTouchEnd(event: TouchEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.controller.isDragging()) {
      const touch = event.changedTouches[0];
      const position = { x: touch.clientX, y: touch.clientY };
      this.controller.endDrag(position);
    }
  }

  /**
   * Vibrate for haptic feedback (mobile)
   */
  private vibrate(duration: number): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  }
}
```

### Key Technologies

- **PixiJS**: Sprite rendering and drag preview
- **TypeScript**: Type-safe event handling
- **RAF**: 60fps position updates
- **Touch Events API**: Mobile support
- **Pointer Events API**: Unified input (future)

---

## Success Criteria

### MVP Definition of Done

- [ ] Mouse drag-and-drop works smoothly at 60fps
- [ ] Touch long-press + drag works on mobile devices
- [ ] Valid/invalid placement shows immediate visual feedback
- [ ] Creature snaps back to roster on invalid drop
- [ ] ESC key cancels drag and returns creature
- [ ] Repositioning placed creatures works correctly
- [ ] Cannot drag during locked state (after Ready)
- [ ] Multiple rapid drags don't cause state corruption
- [ ] Works across Chrome, Firefox, Safari, Edge
- [ ] Touch events don't trigger page scroll during drag
- [ ] Dragged sprite renders above grid but below cursor

---

## L4 Task Candidates

1. **Implement Mouse Event Handlers** (4 hours) - Mouse down/move/up, cursor changes
2. **Implement Touch Event Handlers** (4 hours) - Long press detection, touch move/end
3. **Create Drag State Machine** (3 hours) - State transitions, validation
4. **Implement Position Tracking** (2 hours) - 60fps updates, pixel-to-hex conversion
5. **Implement Drop Validation** (3 hours) - Zone checks, occupied detection
6. **Implement Snap-Back Animation** (2 hours) - Return to roster on failure
7. **Implement Repositioning Logic** (3 hours) - Drag from grid to new hex
8. **Implement Removal Drag** (2 hours) - Drag back to roster
9. **Add Haptic Feedback** (1 hour) - Vibration on touch devices
10. **Add Sound Effects** (2 hours) - Pickup, place, error sounds
11. **Implement ESC Cancel** (1 hour) - Keyboard cancel
12. **Cross-Browser Testing** (4 hours) - Desktop and mobile

**Total: 31 hours (~1 week)**

---

## Dependencies

### Depends On
- **Hex Math Library** (L3): Pixel-to-hex conversion
- **Grid Rendering** (L3): Visual feedback, highlights
- **Deployment Validation** (L3): Placement rules

### Depended On By
- **Deployment UI Manager** (L3): Integrates drag with UI
- **Server Validation** (L3): Sends placement to server

---

## Metadata

**Feature ID**: `drag-drop-placement-controller`
**Epic**: Hex Grid Deployment System
**Priority**: CRITICAL
**Estimated Effort**: 1 week
**Complexity**: MEDIUM-HIGH
