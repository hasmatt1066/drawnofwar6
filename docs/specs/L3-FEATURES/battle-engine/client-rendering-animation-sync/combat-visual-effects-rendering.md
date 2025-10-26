# L3 Feature Specification: Combat Visual Effects Rendering System

**Parent Epic:** L2-EPICS/battle-engine/client-rendering-animation-sync.md
**Status:** Planning Complete - Ready for Implementation
**Created:** 2025-10-25
**Technical Design:** Approved

---

## Overview

The Combat Visual Effects Rendering System provides smooth, 60 FPS visual feedback for all combat interactions by implementing a single, centralized render loop that updates sprite transforms independently from server state updates. This system eliminates ghost trails, fixes health bar positioning, enables damage number animations, implements projectile interpolation, and restores animation state transitions.

**Core Problem:**
The current implementation suffers from sprite duplication (ghost trails), non-tracking health bars, non-animating damage numbers, non-interpolating projectiles, and missing animation state transitions. These issues stem from mixing state updates (10 Hz) with rendering concerns (60 FPS target) and lacking a centralized render loop.

**Solution:**
Implement a single render loop in CombatVisualizationManager that:
- Updates sprite transforms at 60 FPS (not re-rendering)
- Creates/destroys objects on state updates (10 Hz)
- Interpolates entity positions between server ticks
- Animates visual effects (damage numbers, projectiles)
- Drives animation state machine transitions

**Impact:**
This enables players to experience smooth, responsive combat visuals with proper visual feedback for all combat interactions, eliminating existing bugs and establishing a solid foundation for future combat visual effects.

---

## Research Foundation

This implementation is based on comprehensive research into game development best practices:

### Industry Patterns Applied
1. **ECS Architecture**: Components = data, Systems = behavior
2. **PixiJS Best Practices**: Transform updates only, no sprite re-rendering
3. **Update/Render Separation**: State at 10 Hz, visuals at 60 FPS
4. **Entity Interpolation**: Render "in the past" for smooth multiplayer movement

### Key Research Findings
- **Sprite Rendering**: Update transforms (`sprite.x`, `sprite.y`), never re-render
- **Delta Time**: All animations use delta time for frame-rate independence
- **Server Authority**: Server controls gameplay, client smooths visuals
- **Object Pooling**: Pre-allocate and reuse instances for performance

---

## User Stories

### As a player, I want to...
1. **See health bars above units engaged in combat** so I can track unit health during battles
2. **See damage numbers float up when units take damage** so I receive immediate feedback on combat outcomes
3. **See projectiles fly smoothly from attacker to target** so ranged attacks feel responsive and natural
4. **See units transition between IDLE, WALK, and ATTACK animations** so unit behavior is visually clear
5. **Experience smooth 60 FPS combat visuals** so battles feel fluid and responsive without stuttering or ghost trails

---

## Functional Requirements

### FR-1: Single Render Loop (60 FPS)
**Requirement:** Central render loop updates all visual effects at 60 FPS using requestAnimationFrame

**Acceptance Criteria:**
- [ ] Render loop runs via requestAnimationFrame in CombatVisualizationManager
- [ ] Delta time calculated each frame for frame-rate independence
- [ ] Render loop can start/stop cleanly (no orphaned loops)
- [ ] No duplicate render loops exist (single source of truth)
- [ ] Render loop continues until explicitly stopped

---

### FR-2: Sprite Transform Updates
**Requirement:** Sprite positions updated via transform properties, not re-rendering

**Acceptance Criteria:**
- [ ] Sprites created once on state update (10 Hz)
- [ ] `sprite.x` and `sprite.y` updated in render loop (60 FPS)
- [ ] Position interpolated between server ticks
- [ ] No sprite duplication (eliminates ghost trails)
- [ ] Sprite references maintained in Map<string, Sprite>

---

### FR-3: Health Bar Position Tracking
**Requirement:** Health bars follow unit sprites smoothly during movement

**Acceptance Criteria:**
- [ ] Health bars created when unit enters combat
- [ ] Positions updated every frame to track sprite positions
- [ ] Health bars removed when unit dies or leaves combat
- [ ] Smooth tracking during unit movement (no jitter)
- [ ] Health bar offset above sprite accounts for sprite height

---

### FR-4: Damage Number Animation
**Requirement:** Damage numbers float up and fade out over 1 second

**Acceptance Criteria:**
- [ ] Damage numbers spawn on damage events from state diff
- [ ] Float upward at constant rate (50 pixels/second)
- [ ] Fade out using quadratic easing (`1 - (t^2)`)
- [ ] Use object pooling (reuse DamageNumber instances)
- [ ] Cleanup after animation completes
- [ ] Display correct damage value

---

### FR-5: Projectile Entity Interpolation
**Requirement:** Projectiles fly smoothly between server positions using client-side interpolation

**Acceptance Criteria:**
- [ ] Projectiles spawn on server projectile creation event
- [ ] Client interpolates (lerp) toward server position at 60 FPS
- [ ] Rotation follows movement direction
- [ ] Despawn when server removes projectile
- [ ] Smooth flight animation at 60 FPS (no teleporting)
- [ ] Use sprite texture based on attack type

---

### FR-6: Animation State Machine Integration
**Requirement:** Unit animations transition based on server state changes

**Acceptance Criteria:**
- [ ] IDLE → WALK transition when position changes
- [ ] WALK → ATTACK transition when currentTarget is set
- [ ] ATTACK → IDLE transition when currentTarget becomes null
- [ ] Sprite texture updates on state change
- [ ] Smooth transitions (no popping)

---

### FR-7: Performance Optimization
**Requirement:** Maintain 45+ FPS with full effect load

**Acceptance Criteria:**
- [ ] Frustum culling for off-screen effects
- [ ] Object pooling for damage numbers and projectiles
- [ ] FPS tracking and measurement
- [ ] Graceful degradation below 45 FPS

---

## Technical Architecture

### Component Overview
```
CombatVisualizationManager (Orchestrator)
├── Render Loop (60 FPS)
│   ├── Sprite Transform Update System
│   ├── Health Bar Position Tracker
│   ├── Damage Number Animator
│   ├── Projectile Interpolator
│   └── Performance Monitor
│
└── State Update Handler (10 Hz)
    ├── Sprite Lifecycle Manager
    ├── Animation State Machine
    ├── Health Bar Lifecycle Manager
    └── Event Emitter
```

### Data Flow
```
Server State (10 Hz) → Create/Destroy Objects
                     ↓
Render Loop (60 FPS) → Update Transforms → Animate Effects
```

---

## L4 Task Breakdown

### Phase 1: Core Render Loop (Foundation)
1. **TASK-RENDER-001**: Refactor render loop into CombatVisualizationManager (3h)
2. **TASK-RENDER-002**: Implement delta time tracking (2h)
3. **TASK-RENDER-003**: Add render loop lifecycle (2h)
4. **TASK-RENDER-004**: Separate state update handler from render loop (3h)

### Phase 2: Sprite Transform System
5. **TASK-RENDER-005**: Implement sprite transform update system (3h)
6. **TASK-RENDER-006**: Integrate PositionInterpolator with render loop (3h)
7. **TASK-RENDER-007**: Add sprite lifecycle management (4h)

### Phase 3: Health Bar System
8. **TASK-RENDER-008**: Implement health bar position tracking (3h)
9. **TASK-RENDER-009**: Add health bar combat detection (3h)
10. **TASK-RENDER-010**: Implement health bar cleanup on death (2h)

### Phase 4: Damage Number System
11. **TASK-RENDER-011**: Implement damage number animation loop (4h)
12. **TASK-RENDER-012**: Add damage number spawning from events (3h)
13. **TASK-RENDER-013**: Implement damage number object pooling (4h)

### Phase 5: Projectile System
14. **TASK-RENDER-014**: Implement projectile entity interpolation (4h)
15. **TASK-RENDER-015**: Add projectile spawning/despawning (3h)
16. **TASK-RENDER-016**: Implement projectile rotation toward target (2h)

### Phase 6: Animation State Machine
17. **TASK-RENDER-017**: Restore animation state machine to state handler (3h)
18. **TASK-RENDER-018**: Implement IDLE/WALK/ATTACK transitions (3h)
19. **TASK-RENDER-019**: Add sprite texture updates on animation change (2h)

### Phase 7: Performance Optimization
20. **TASK-RENDER-020**: Implement frustum culling (3h)
21. **TASK-RENDER-021**: Add FPS tracking and measurement (3h)
22. **TASK-RENDER-022**: Implement graceful degradation logic (4h)

### Phase 8: Integration & Testing
23. **TASK-RENDER-023**: Integration test with spawn-to-battle (4h)
24. **TASK-RENDER-024**: Performance benchmarking (3h)
25. **TASK-RENDER-025**: Visual regression testing (4h)

**Total Estimated Effort:** 75 hours

---

## Success Criteria

### Functional Success
- [ ] No ghost trails (sprite duplication eliminated)
- [ ] Health bars track moving sprites smoothly
- [ ] Damage numbers animate (float + fade)
- [ ] Projectiles interpolate smoothly
- [ ] Animation states transition correctly
- [ ] All visual effects render simultaneously

### Performance Success
- [ ] 60 FPS with 16 creatures and full effects
- [ ] 45+ FPS with degradation under load
- [ ] Render loop overhead <2ms per frame
- [ ] No memory leaks over extended sessions
- [ ] Graceful degradation works correctly

### Code Quality Success
- [ ] >80% test coverage
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks documented
- [ ] Visual regression tests passing
- [ ] Clean separation of concerns
- [ ] Well-documented code

---

## Implementation Notes

See detailed task specifications in the full document for:
- Exact file paths to modify/create
- Test case specifications
- Implementation pseudocode
- Integration points
- Performance targets

---

**Status:** Ready for Implementation
**Next Step:** Begin with TASK-RENDER-001 (Refactor render loop)
