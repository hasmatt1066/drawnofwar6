# L3 Feature Specification: Camera Control System

**Feature ID**: `L3-CAMERA-CONTROL`
**Parent Epic**: Client Rendering & Animation Sync (L2)
**Status**: SPECIFICATION COMPLETE
**Version**: 1.0
**Last Updated**: 2025-10-05

---

## Overview

Implement a flexible camera system for the PixiJS battlefield renderer that gives players full manual control over their view (zoom, pan, focus) while optionally auto-following important combat actions. The system supports mouse wheel zoom (0.5x-2.0x range), middle-mouse-button drag panning, double-click focus on creatures/hexes, and an optional toggle for automatic camera tracking of action hotspots (attacks, abilities, deaths).

**User Value**: Players can zoom out for tactical overview or zoom in to watch animations closely. Auto-follow keeps the action centered without requiring constant manual adjustment.

**Technical Value**: Decouples camera control from rendering logic, enables future features like replay scrubbing and spectator mode, provides smooth transitions that don't interrupt combat flow.

---

## Functional Requirements

### FR-1: Manual Zoom Control
**Description**: Mouse wheel scrolls zoom the camera in/out within defined bounds.

**Behavior**:
- **Zoom Range**: 0.5x (zoomed out, see full battlefield) to 2.0x (zoomed in, see creature detail)
- **Default Zoom**: 1.0x (normal view, entire battlefield visible on 1080p screen)
- **Zoom Increment**: 0.1x per mouse wheel tick
- **Zoom Center**: Zoom toward mouse cursor position (not screen center)
- **Smooth Transition**: 200ms eased zoom animation (exponential easing)
- **Boundary Enforcement**: Prevent zooming beyond min/max bounds

**Edge Cases**:
- If user scrolls rapidly (5+ ticks within 500ms), queue zoom events and apply smoothly
- If zoom would push battlefield edge into viewport, clamp to battlefield bounds
- At max zoom (2.0x), show subtle visual indicator (vignette or UI hint)

**Acceptance Criteria**:
- Mouse wheel up zooms in by 0.1x
- Mouse wheel down zooms out by 0.1x
- Zoom clamped to [0.5x, 2.0x]
- Zoom animates smoothly over 200ms
- Zoom centers on mouse cursor position
- Rapid scrolling queued, not skipped

---

### FR-2: Manual Pan Control
**Description**: Middle-mouse-button drag pans the camera across the battlefield.

**Behavior**:
- **Trigger**: Middle mouse button down + drag
- **Pan Speed**: 1:1 ratio (drag 100px = pan 100px)
- **Boundary Enforcement**: Cannot pan beyond battlefield edges
- **Smooth Deceleration**: On release, camera continues with momentum for 300ms (friction deceleration)
- **Interrupt Auto-Follow**: Manual pan disables auto-follow until re-enabled

**Edge Cases**:
- If dragging at battlefield edge, resist further panning (elastic boundary effect)
- If dragging while zoomed in, adjust pan bounds based on zoom level
- If user releases middle button outside canvas, still complete pan action

**Acceptance Criteria**:
- Middle-mouse drag pans camera
- Pan clamped to battlefield bounds
- Momentum continues for 300ms after release
- Manual pan disables auto-follow
- Elastic resistance at battlefield edges

---

### FR-3: Focus on Point (Double-Click)
**Description**: Double-click a creature or hex to center camera on that position.

**Behavior**:
- **Trigger**: Double-click on creature sprite or hex
- **Target**: Center clicked position in viewport
- **Transition**: 400ms smooth pan/zoom to target
- **Zoom Adjustment**: If current zoom < 1.0x, zoom to 1.0x during transition
- **Focus Lock**: Optional 3-second lock where camera stays centered on target

**Edge Cases**:
- If double-clicking moving creature, predict position 400ms ahead (where it will be after transition)
- If double-clicking during another transition, cancel previous and start new
- If double-clicking creature that dies mid-transition, complete transition to death position

**Acceptance Criteria**:
- Double-click creature centers camera on creature
- Double-click hex centers camera on hex
- Transition animates smoothly over 400ms
- If zoomed out < 1.0x, zooms to 1.0x during transition
- Cancels previous transitions

---

### FR-4: Auto-Follow Combat Actions (Optional Toggle)
**Description**: When enabled, camera automatically pans to important combat events.

**Behavior**:
- **Toggle**: UI checkbox "Auto-Follow Actions" (default: OFF)
- **Tracked Events**: Ability casts, melee attacks, deaths, AOE impacts
- **Priority**: Deaths > AOE abilities > single-target attacks
- **Transition**: 600ms smooth pan to event location
- **Interrupt**: Manual camera control (zoom, pan, focus) disables auto-follow
- **Re-enable**: User must manually toggle auto-follow back on

**Event Handling**:
- **Single Event**: Pan to event location, hold for 1.5 seconds, return to previous view
- **Multiple Events**: Queue events, show highest priority first
- **Simultaneous Events**: Pan to midpoint between events

**Edge Cases**:
- If multiple deaths occur simultaneously, pan to center of death cluster
- If event occurs off-screen while zoomed in, zoom out to 1.0x then pan
- If user toggles auto-follow mid-transition, complete current transition

**Acceptance Criteria**:
- UI toggle controls auto-follow feature
- Camera pans to abilities, attacks, deaths
- Transitions smooth over 600ms
- Manual control disables auto-follow
- Queues multiple events, shows highest priority

---

### FR-5: Battlefield Bounds & Constraints
**Description**: Camera movement constrained to logical battlefield area.

**Behavior**:
- **Battlefield Size**: 16x16 hex grid (actual combat area ~12x12 hexes)
- **Pan Bounds**: Camera cannot pan beyond battlefield edges
- **Zoom Bounds**: At max zoom (2.0x), prevent panning that shows empty space
- **Dynamic Bounds**: Adjust bounds based on current zoom level
- **Edge Behavior**: Elastic resistance at boundaries (allow slight overpan, then snap back)

**Calculations**:
```typescript
// Viewport dimensions
const viewportWidth = 1920; // px
const viewportHeight = 1080; // px

// Battlefield dimensions in pixels (at 1.0x zoom)
const battlefieldWidth = 1600; // px
const battlefieldHeight = 1200; // px

// At zoom level Z, pan bounds are:
const minX = -(battlefieldWidth * Z - viewportWidth) / 2;
const maxX = (battlefieldWidth * Z - viewportWidth) / 2;
const minY = -(battlefieldHeight * Z - viewportHeight) / 2;
const maxY = (battlefieldHeight * Z - viewportHeight) / 2;

// If battlefield smaller than viewport, center it
if (battlefieldWidth * Z < viewportWidth) {
  minX = maxX = 0;
}
```

**Acceptance Criteria**:
- Camera cannot pan beyond battlefield edges
- Bounds adjust dynamically with zoom
- Elastic resistance at boundaries
- Battlefield centered if smaller than viewport

---

## Technical Architecture

### Components

**CameraController** (`frontend/src/components/BattlefieldCamera/CameraController.ts`)
- Main camera state manager
- Handles all input events (wheel, drag, click)
- Manages camera position, zoom, transitions
- Exposes API for auto-follow and focus commands

**InputHandler** (`frontend/src/components/BattlefieldCamera/InputHandler.ts`)
- Mouse event listeners (wheel, mousedown, mousemove, mouseup, dblclick)
- Keyboard shortcuts (arrow keys for pan, +/- for zoom)
- Detects gestures (middle-drag, double-click, rapid scroll)
- Translates input to camera commands

**TransitionManager** (`frontend/src/components/BattlefieldCamera/TransitionManager.ts`)
- Smooth animation between camera states
- Easing functions (exponential, cubic)
- Transition queue (cancel/queue multiple transitions)
- Momentum physics for pan deceleration

**BoundsConstraint** (`frontend/src/components/BattlefieldCamera/BoundsConstraint.ts`)
- Calculate valid pan bounds based on zoom
- Clamp camera position to battlefield area
- Elastic boundary effect (overpan + snap back)
- Handle edge cases (battlefield smaller than viewport)

**AutoFollowSystem** (`frontend/src/components/BattlefieldCamera/AutoFollowSystem.ts`)
- Listen to combat events from server
- Prioritize events (deaths > abilities > attacks)
- Queue events when multiple occur
- Issue focus commands to CameraController

**CameraState** (TypeScript Interface)
```typescript
interface CameraState {
  // Position (in world coordinates, pixels)
  x: number;
  y: number;

  // Zoom level
  zoom: number; // [0.5, 2.0]

  // Target state (for transitions)
  targetX: number;
  targetY: number;
  targetZoom: number;

  // Transition state
  isTransitioning: boolean;
  transitionStartTime: number;
  transitionDuration: number; // ms
  transitionEasing: 'linear' | 'exponential' | 'cubic';

  // Auto-follow state
  autoFollowEnabled: boolean;
  focusLockUntil: number; // timestamp, 0 = not locked
}
```

**Integration with PixiJS**
```typescript
class BattlefieldRenderer {
  private camera: CameraController;
  private stage: PIXI.Container;

  render(deltaTime: number) {
    // Update camera (handle transitions)
    this.camera.update(deltaTime);

    // Apply camera transform to stage
    this.stage.scale.set(this.camera.zoom, this.camera.zoom);
    this.stage.position.set(-this.camera.x, -this.camera.y);

    // Render stage
    this.renderer.render(this.stage);
  }
}
```

---

### State Diagram

```
[Manual Control] ──┐
                   ├──> [Free Roam]
[Auto-Follow OFF] ─┘

[Auto-Follow ON] ──> [Watching Combat] ──> [Event Triggered] ──> [Transition to Event] ──> [Hold Focus 1.5s] ──> [Return to Previous View]
                                                                          │
                                                                          └──> [Manual Control] ──> [Disable Auto-Follow] ──> [Free Roam]
```

---

### Key Algorithms

**Zoom Toward Mouse Cursor**
```typescript
function zoomTowardCursor(currentZoom: number, deltaZoom: number, cursorX: number, cursorY: number) {
  const newZoom = clamp(currentZoom + deltaZoom, MIN_ZOOM, MAX_ZOOM);
  const zoomRatio = newZoom / currentZoom;

  // Calculate world position of cursor before zoom
  const worldX = (cursorX - viewport.width / 2) / currentZoom + camera.x;
  const worldY = (cursorY - viewport.height / 2) / currentZoom + camera.y;

  // After zoom, adjust camera so cursor still points to same world position
  const newCameraX = worldX - (cursorX - viewport.width / 2) / newZoom;
  const newCameraY = worldY - (cursorY - viewport.height / 2) / newZoom;

  return { zoom: newZoom, x: newCameraX, y: newCameraY };
}
```

**Elastic Boundary Resistance**
```typescript
function applyElasticBounds(position: number, min: number, max: number): number {
  if (position < min) {
    const overpan = min - position;
    return min - overpan * 0.3; // Allow 30% overpan with resistance
  } else if (position > max) {
    const overpan = position - max;
    return max + overpan * 0.3;
  }
  return position;
}
```

**Smooth Transition (Exponential Easing)**
```typescript
function updateTransition(state: CameraState, deltaTime: number) {
  if (!state.isTransitioning) return;

  const elapsed = Date.now() - state.transitionStartTime;
  const progress = Math.min(elapsed / state.transitionDuration, 1.0);

  // Exponential easing out
  const easedProgress = 1 - Math.exp(-5 * progress);

  state.x = lerp(state.x, state.targetX, easedProgress);
  state.y = lerp(state.y, state.targetY, easedProgress);
  state.zoom = lerp(state.zoom, state.targetZoom, easedProgress);

  if (progress >= 1.0) {
    state.isTransitioning = false;
  }
}
```

---

## Dependencies

### Depends On
- **PixiJS Battlefield Renderer** (L3): Camera transforms applied to PixiJS stage
- **Hex Grid Background Layer** (L3): Battlefield bounds defined by hex grid size
- **State Update Processor** (L3): Combat events trigger auto-follow
- **Event Queue Manager** (L3): Events prioritized for auto-follow

### Depended On By
- **Replay Playback** (Future): Camera state must be serializable for replay
- **Spectator Mode** (Future): Spectators can toggle auto-follow independently
- **Mobile Touch Controls** (Future): Pinch-to-zoom and drag-to-pan on mobile

---

## Success Criteria

### MVP Definition of Done
- [ ] Mouse wheel zoom works (0.5x-2.0x range, 0.1x increments)
- [ ] Zoom centers on mouse cursor position
- [ ] Zoom transitions smoothly over 200ms
- [ ] Middle-mouse drag pans camera
- [ ] Pan clamped to battlefield bounds
- [ ] Pan momentum continues for 300ms after release
- [ ] Elastic boundary resistance at battlefield edges
- [ ] Double-click creature/hex centers camera with 400ms transition
- [ ] Auto-follow toggle in UI (default OFF)
- [ ] Auto-follow pans to abilities, attacks, deaths
- [ ] Auto-follow prioritizes deaths > abilities > attacks
- [ ] Manual control disables auto-follow
- [ ] Camera state persists across rounds (zoom/position remembered)
- [ ] No performance impact (camera updates run at 60 FPS)

### Exceptional Targets (Post-MVP)
- [ ] Keyboard shortcuts (arrow keys pan, +/- zoom, spacebar toggle auto-follow)
- [ ] Minimap with camera viewport indicator
- [ ] Smooth camera shake on big impacts (integrated with camera system)
- [ ] Cinematic mode (auto-follow with dramatic zoom/pan curves)
- [ ] Replay timeline scrubbing (camera follows timeline cursor)
- [ ] Multi-camera presets (tactical view, closeup view, free cam)

---

## L4 Task Candidates

### Phase 1: Core Camera System (5 tasks)
- **L4-CAM-001**: Implement `CameraState` interface and `CameraController` class
  - Camera state (position, zoom, target, transition)
  - Update loop (apply transitions, clamp bounds)
  - Public API (setZoom, setPosition, focus, startTransition)

- **L4-CAM-002**: Implement `InputHandler` for mouse/keyboard events
  - Mouse wheel listener (zoom toward cursor)
  - Middle-mouse drag listener (pan)
  - Double-click listener (focus on point)
  - Keyboard shortcuts (arrow keys, +/-)

- **L4-CAM-003**: Implement `TransitionManager` for smooth animations
  - Transition state machine
  - Easing functions (exponential, cubic)
  - Transition queue (cancel/queue)
  - Momentum physics for pan deceleration

- **L4-CAM-004**: Implement `BoundsConstraint` for battlefield limits
  - Calculate pan bounds based on zoom
  - Clamp camera position
  - Elastic boundary effect
  - Handle battlefield smaller than viewport

- **L4-CAM-005**: Integrate camera with PixiJS renderer
  - Apply camera transform to PIXI.Container
  - Update camera in render loop
  - Test zoom/pan with hex grid rendering

### Phase 2: Auto-Follow System (3 tasks)
- **L4-CAM-006**: Implement `AutoFollowSystem` event listener
  - Subscribe to combat events (abilities, attacks, deaths)
  - Prioritize events (deaths > abilities > attacks)
  - Queue events when multiple occur
  - Issue focus commands to CameraController

- **L4-CAM-007**: Implement auto-follow UI toggle
  - Checkbox "Auto-Follow Actions"
  - Enable/disable auto-follow
  - Persist setting in local storage
  - Visual indicator when auto-follow active

- **L4-CAM-008**: Implement auto-follow transition logic
  - Pan to event location (600ms)
  - Hold focus for 1.5 seconds
  - Return to previous view
  - Handle manual interrupt (disable auto-follow)

### Phase 3: Edge Cases & Polish (4 tasks)
- **L4-CAM-009**: Handle rapid zoom scrolling
  - Queue zoom events
  - Apply smoothly (not all at once)
  - Visual feedback for min/max zoom

- **L4-CAM-010**: Handle double-click on moving creatures
  - Predict creature position 400ms ahead
  - Track creature during transition
  - Complete transition even if creature dies

- **L4-CAM-011**: Handle multiple simultaneous events
  - Calculate midpoint between events
  - Pan to midpoint
  - Show all events in sequence

- **L4-CAM-012**: Persist camera state across rounds
  - Save zoom/position to local storage
  - Restore on next combat
  - Reset button to default view

### Phase 4: Testing & Documentation (3 tasks)
- **L4-CAM-013**: Unit tests for camera calculations
  - Zoom toward cursor math
  - Bounds clamping logic
  - Transition easing functions

- **L4-CAM-014**: Integration tests with PixiJS renderer
  - Test zoom/pan with hex grid
  - Test auto-follow with combat events
  - Test boundary constraints

- **L4-CAM-015**: Create camera control user guide
  - Document all controls (wheel, drag, double-click)
  - Auto-follow explanation
  - Keyboard shortcuts reference

**Total: 15 tasks**

---

## Open Questions & Clarifications

### Q1: Default Camera Position
**Question**: Should camera start centered on player's deployment zone or centered on entire battlefield?

**Options**:
- **Centered on player zone**: Better for deployment phase, but may need to zoom out for combat
- **Centered on battlefield**: Better for combat, but player zone may be off-screen

**Recommendation**: Start centered on player deployment zone during deployment, then smoothly transition to centered battlefield when combat starts.

---

### Q2: Auto-Follow Return Behavior
**Question**: After auto-follow shows event, should it return to previous view or stay at event location?

**Options**:
- **Return to previous**: Less disruptive, player maintains context
- **Stay at event**: Simpler logic, but player loses original view

**Recommendation**: Return to previous view (as specified in FR-4), but add option to disable return (stay at event) in settings.

---

### Q3: Zoom Level Persistence
**Question**: Should zoom level persist across different matches or reset to 1.0x each time?

**Options**:
- **Persist**: User preference remembered
- **Reset**: Consistent experience each match

**Recommendation**: Persist zoom level per user in local storage, with "Reset View" button to return to default.

---

### Q4: Boundary Behavior at Max Zoom
**Question**: At 2.0x zoom, should we prevent panning that shows empty space, or allow it with elastic bounds?

**Options**:
- **Hard clamp**: Camera stops at boundary, no overpan
- **Elastic bounds**: Allow slight overpan, snap back on release

**Recommendation**: Elastic bounds (as specified in FR-5), feels more natural and less restrictive.

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Performance degradation during transitions | Medium | Low | Pre-calculate transition curves, use requestAnimationFrame |
| Auto-follow disrupts player-controlled camera | High | Medium | Make auto-follow opt-in (default OFF), disable on manual control |
| Zoom toward cursor math errors | High | Low | Extensive unit tests, visual debugging tools |
| Pan bounds miscalculated at different zoom levels | Medium | Medium | Unit tests for all zoom levels, elastic bounds prevent hard failures |
| Double-click conflicts with single-click selection | Medium | Low | Use 300ms double-click timeout, prioritize selection on first click |

---

## Metadata

- **Estimated Effort**: 1-2 weeks
- **Dependencies**: PixiJS renderer, hex grid layout
- **Priority**: HIGH (affects user experience significantly)
- **Complexity**: MEDIUM (math-heavy, but well-defined)

---

**Status**: Ready for L4 task breakdown and implementation
**Next Steps**: Review open questions, then proceed to task implementation
