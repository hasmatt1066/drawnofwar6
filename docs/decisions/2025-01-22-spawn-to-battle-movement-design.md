# Design Decision Record: Spawn-to-Battle Movement

**Date:** 2025-01-22
**Status:** Approved
**Deciders:** Product Owner, Technical Lead
**Related Documents:**
- L3 Feature Spec: `/docs/specs/L3-FEATURES/battle-engine/client-rendering-animation-sync/spawn-to-battle-movement.md`
- L2 Epic: `/docs/specs/L2-EPICS/battle-engine/client-rendering-animation-sync.md`

---

## Context and Problem Statement

When combat begins after the deployment phase, units need to transition from their deployment positions to combat-ready positions. The transition must feel smooth, cinematic, and engaging while maintaining technical feasibility and server authority.

**Key Questions:**
1. How should units visually spawn/appear when combat starts?
2. Should spawn movement be scripted (client-side) or AI-driven (server-side)?
3. What animations should play during the spawn phase?
4. How do we handle individual unit speed differences?
5. What visual effects should accompany spawning?

---

## Decision Drivers

**User Experience Priorities:**
- Cinematic feel without artificial delays
- Clear visual feedback that combat has started
- Smooth, non-jarring transitions
- Unique visual identity that sets the game apart

**Technical Constraints:**
- Server is authoritative (client cannot predict/script movement)
- Network latency: 100-150ms typical
- Performance target: 60 FPS with 16 units spawning simultaneously
- Existing systems: Position interpolation, animation state machine

**Development Resources:**
- Timeline: ~5-6 days (44 hours) for MVP
- Skill requirements: PIXI.js shader experience for alpha masking
- Asset creation: Custom spawn effect animation

---

## Decisions Made

### Decision 1: Spawn Movement Timing Strategy

**Chosen Option:** Option A - Implicit Movement (AI-Driven)

**Alternatives Considered:**
- **Option A (Chosen):** Units appear at deployment positions, server AI immediately moves them via pathfinding
- Option B: Explicit spawn animation phase with staged movement (units hold still, then move)
- Option C: Hybrid with immediate walk animation

**Rationale:**
- **Aligns with server authority principle**: Client doesn't script movement, server drives everything
- **Simplest implementation**: Uses existing pathfinding system, no special spawn phase logic needed
- **Feels organic**: Units naturally converge based on AI decisions, not artificial choreography
- **No artificial delays**: Combat action begins immediately, maintaining pace

**Trade-offs Accepted:**
- Less "synchronized" spawn (units may start moving at different times based on AI)
- No dramatic "hold" moment before movement begins
- May require iteration on AI to ensure visually appealing initial movement

**Implementation Impact:**
- No server-side changes needed (pathfinding already exists)
- Client simply renders state updates as they arrive
- Spawn effects play independently of movement timing

---

### Decision 2: Animation State Transitions

**Chosen Option:** Option C - Server-Driven (Based on Velocity)

**Alternatives Considered:**
- Option A: Immediate walk animation (units spawn already walking)
- Option B: Brief IDLE → WALK transition with artificial delay
- **Option C (Chosen):** Animation transitions based on server velocity state

**Rationale:**
- **Most accurate synchronization**: Animations perfectly match what server says unit is doing
- **Handles edge cases automatically**: Units that don't move stay IDLE, moving units show WALK
- **Robust to network issues**: If position update delayed, unit stays IDLE until update arrives (looks intentional, not broken)
- **Consistent with design philosophy**: Server authority over client-side heuristics

**Trade-offs Accepted:**
- Animation timing depends on server tick rate and network latency
- Possible slight delay between spawn effect completing and walk animation starting
- Requires position diff detection in client state management

**Implementation Impact:**
- Add state diff detection in `CombatVisualizationManager`
- Monitor position changes between ticks → trigger WALK
- Monitor static position → trigger IDLE
- Existing `UnitAnimationStateMachine` handles transitions

---

### Decision 3: Movement Speed During Spawn Phase

**Chosen Option:** Option A (Modified) - Individual Unit Speed Attributes

**Alternatives Considered:**
- Option A: Normal speed (same as combat movement)
- Option B: Faster spawn speed (1.5x normal)
- Option C: Distance-based speed (synchronized arrival)
- **Modified Option A (Chosen):** Use individual unit speed attributes assigned during creature generation

**Rationale:**
- **Tactical depth**: Speed differences create visual variety and strategic implications
- **Consistent with game design**: Attributes assigned during generation should be visible in combat
- **No special cases**: Same speed system used for spawn and combat movement
- **Scalable**: Can adjust speed ranges during balance tuning without changing spawn code

**Speed Ranges Defined:**
- Tank archetype: Speed 1 (slow, armored)
- Melee DPS: Speed 2 (medium)
- Ranged DPS: Speed 2 (medium)
- Mage: Speed 1.5 (slow, fragile)
- Support: Speed 2 (medium mobility)

**Animation Sync Decision:**
Walk animation FPS scales with speed:
- Speed 1 → 4 FPS walk animation (slower stepping)
- Speed 2 → 8 FPS walk animation (normal)
- Speed 3 → 12 FPS walk animation (faster stepping)

**Trade-offs Accepted:**
- Spawn phase duration varies (fast units arrive at combat positions sooner)
- Some creatures may still be walking when others start attacking
- Requires animation speed scaling system

**Implementation Impact:**
- Add `AnimationSpeedScaler` class
- Modify `UnitAnimationStateMachine` to apply speed scaling
- Backend already has speed attributes (no changes needed)

---

### Decision 4: Visual Feedback During Spawn

**Chosen Option:** Custom - Westworld-Inspired Blue Liquid Emergence Effect

**Alternatives Considered:**
- Option A: Minimal (movement only, no special effects)
- Option B: Subtle emphasis (highlight borders)
- Option C: Full spawn effects (particles, shimmer)
- **Custom Option (Chosen):** Blue liquid emergence (inspired by Westworld opening sequence)

**Rationale:**
- **Unique visual identity**: Sets the game apart from generic auto-battlers
- **Thematic fit**: Creatures are AI-generated, emergence from liquid suggests "creation" / "birth"
- **Cinematic quality**: High-polish effect creates memorable moments
- **Product Owner preference**: Explicitly requested during planning session

**Visual Specification:**
- Blue liquid puddle (#2E9AFE) appears at unit's deployment hex
- Liquid animates upward (radial expansion → vertical rise)
- Creature sprite revealed progressively from bottom to top (alpha masking)
- Effect duration: 800-1000ms
- Creature can start moving while effect plays (non-blocking)

**Technical Approach:**
- PIXI.AnimatedSprite for liquid animation (20-frame sprite sheet)
- PIXI.Graphics mask for creature reveal (bottom-to-top alpha masking)
- Object pooling for spawn effect sprites (memory efficiency)
- GPU-accelerated shaders for smooth alpha gradients

**Trade-offs Accepted:**
- Higher implementation effort (8-10 hours vs 2-3 for minimal)
- Asset creation required (sprite sheet design)
- Potential performance impact (mitigated via GPU shaders and pooling)
- May need visual adjustments based on playtesting feedback

**Implementation Impact:**
- New component: `SpawnEffectRenderer`
- New asset: 256x256 blue liquid sprite sheet (20 frames)
- New component: `CreatureEmergenceMask` for alpha masking
- Integration with `CombatVisualizationManager`

---

### Decision 5: Edge Case Handling

#### Edge Case A: Unit Already in Combat Position

**Scenario:** Deployment position equals optimal combat position (rare but possible, e.g., ranged unit at back line)

**Decision:** Unit stays stationary, transitions directly IDLE → ATTACK

**Rationale:**
- Forced movement would look artificial and confusing
- Ranged units staying at back line makes tactical sense
- Simpler implementation (no special movement choreography)

**Implementation:**
```typescript
if (unit.deploymentPosition === unit.position && unit.currentTarget) {
  if (isInAttackRange(unit, unit.currentTarget)) {
    stateMachine.transitionTo(unit.unitId, AnimationState.ATTACK);
  }
}
```

---

#### Edge Case B: Late Position Updates

**Scenario:** Server position update doesn't arrive for 500ms+ due to network lag

**Decision:** Unit stays at deployment position in IDLE animation until update arrives

**Rationale:**
- No client-side prediction during spawn (respects server authority)
- IDLE animation loops naturally, doesn't look "frozen"
- Graceful degradation (waiting looks intentional, not broken)
- Avoids incorrect movement predictions

**Rejected Alternative:** Dead reckoning prediction
- Would violate server authority principle
- Could cause desyncs if prediction wrong
- Not worth complexity for edge case

---

#### Edge Case C: Unit Dies During Spawn

**Scenario:** Unit takes fatal damage while spawn effect is still playing (e.g., enemy AOE ability at spawn location)

**Decision:** Spawn effect completes first, then death animation plays

**Rationale:**
- Players invested in seeing spawn animation complete (cinematic moment)
- Interrupting spawn feels jarring and confusing
- Total sequence remains short (1.6s: spawn 1s + death 0.6s)
- Maintains visual polish

**Implementation:**
```typescript
if (unit.isDead && unit.isSpawning) {
  unit.queuedState = AnimationState.DEATH;
  onSpawnComplete(() => {
    stateMachine.transitionTo(unit.unitId, AnimationState.DEATH);
  });
}
```

**Rejected Alternative:** Interrupt spawn with immediate death
- Feels unpolished (sudden interruption)
- Wastes spawn effect (player doesn't see it complete)
- Combat log would be confusing ("Unit died before appearing")

---

## Consequences

### Positive

**User Experience:**
- ✅ Unique, memorable spawn visuals (blue liquid emergence)
- ✅ Smooth, organic movement driven by AI
- ✅ Tactical depth from speed differences (fast vs slow units visible)
- ✅ No artificial delays (combat starts immediately)
- ✅ Edge cases handled gracefully (looks polished, not buggy)

**Technical:**
- ✅ Maintains server authority principle (no client-side scripting)
- ✅ Uses existing systems (pathfinding, animation state machine, interpolation)
- ✅ Performance optimized (object pooling, GPU shaders)
- ✅ Network resilient (handles latency gracefully)

**Development:**
- ✅ Clear implementation path with atomic tasks (L4 breakdown)
- ✅ Testable (97+ unit tests defined)
- ✅ Reasonable timeline (~5.5 days for MVP)

---

### Negative

**Implementation Effort:**
- ❌ Higher than minimal approach (44 hours vs ~10 hours for basic spawn)
- ❌ Requires custom asset creation (sprite sheet design)
- ❌ Requires PIXI.js shader knowledge (alpha masking)

**Design Trade-offs:**
- ❌ Less synchronized spawn (units start moving at different times)
- ❌ No dramatic "pause and reveal" moment (Option B would have provided this)
- ❌ Spawn phase duration varies based on unit speeds (inconsistent timing)

**Technical Debt:**
- ❌ Custom spawn effect system (not reusable for other game elements)
- ❌ Animation speed scaling adds complexity to state machine
- ❌ Edge case handling (death during spawn) adds special-case logic

---

### Mitigation Strategies

**For Implementation Effort:**
- Start with simplified spawn effect (can enhance later)
- Use placeholder sprite sheet during development
- Parallelize asset creation with code development

**For Synchronized Spawn:**
- Iterate on AI to make initial movement feel coordinated
- Option to add "formation hold" behavior post-MVP if needed
- Spawn effect synchronizes across all units (visual unity despite movement differences)

**For Technical Debt:**
- Spawn effect renderer designed with extensibility in mind (can add other effects later)
- Animation speed scaling isolated in dedicated class (can refactor if needed)
- Edge case logic well-documented and tested

---

## Validation Criteria

**How We'll Know This Was the Right Decision:**

1. **Playtest Feedback** (Week 1 after implementation)
   - Players describe spawn moment as "cool", "unique", or "cinematic"
   - No confusion about when combat starts
   - No complaints about units "teleporting" or "glitching"

2. **Performance Metrics** (Week 2)
   - 60 FPS maintained with 16 units spawning (measured)
   - <1% of matches show spawn-related bugs
   - Network latency 100-150ms handled without visual issues

3. **User Analytics** (Month 1)
   - Players don't skip spawn animations (if skip feature added)
   - Average engagement time during spawn phase: 2-3 seconds (not longer)
   - No spike in disconnections during spawn phase

4. **Development Velocity** (Implementation phase)
   - L4 tasks completed within estimated effort (±20%)
   - Unit tests pass at >95% coverage
   - No major refactors needed during implementation

---

## Reversibility

**If This Decision Proves Wrong:**

**Easy to Reverse:**
- Visual feedback (spawn effect) can be simplified or removed without affecting gameplay
- Animation speed scaling can be disabled (revert to fixed 8 FPS)
- Edge case handling can be adjusted based on real-world frequency

**Difficult to Reverse:**
- AI-driven movement approach (would require server-side spawn choreography system)
- Server authority principle (fundamental to architecture)

**Monitoring Plan:**
- Weekly playtest sessions for first month
- Track bug reports related to spawn phase
- A/B test spawn effect variations if player feedback mixed

---

## Related Decisions

**Previous Decisions:**
- [2025-10-05] L2 Epic: Client Rendering & Animation Sync - Defined timestamp-based animation synchronization
- [2025-10-03] L2 Epic: Authoritative Server Simulation - Established server authority principle

**Future Decisions:**
- Post-MVP: Spawn effect variants (team colors, archetype-specific)
- Post-MVP: Synchronized formation movement (optional)
- Post-MVP: Camera cinematics during spawn (optional auto-focus)

---

## Lessons Learned (To Be Updated Post-Implementation)

_This section will be updated after implementation completes._

**Questions to Answer:**
- Was the Westworld-inspired effect worth the implementation effort?
- Did animation speed scaling create the intended tactical depth?
- Were edge cases as rare as predicted?
- Did AI-driven movement feel organic or chaotic?

---

**Approval Signatures:**
- Product Owner: [Approved 2025-01-22]
- Technical Lead: [Approved 2025-01-22]

**Next Step:** Begin implementation with TASK-SPAWN-001 (Spawn Effect Asset Creation)
