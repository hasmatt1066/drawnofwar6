# L0 Vision: Drawn of War

## Purpose

Drawn of War exists to democratize game creation by allowing players to manifest their imagination directly into gameplay through AI-powered creature generation. We're solving the fundamental disconnect between creative vision and technical execution in gaming - where players have always been limited to pre-designed assets and mechanics.

### The Problem We're Solving
- **For Players**: Limited creative expression in traditional games where you can only use pre-made characters
- **For Gaming**: Stale meta-games where optimal strategies become solved and predictable
- **For Society**: High barriers to game creation that exclude non-technical creative minds

### Why This Matters Now
- AI technology has reached the threshold where real-time, high-quality asset generation is feasible
- Players increasingly expect personalized, creative experiences in their entertainment
- The success of games like Gartic Phone and AI Dungeon proves appetite for AI-enhanced creativity

## Success Criteria

### Technical Success Metrics
- **Generation Speed**: Creature fully generated and animated in 2-5 minutes
- **Generation Success**: 95% of submissions produce playable creatures
- **Animation Assignment**: 100% of creatures receive appropriate animation sets
- **Animation Variety**: Average 15+ unique animations active per battle
- **Match Stability**: Less than 1% of matches experience disconnection issues
- **Performance**: Maintain 30+ FPS on average laptop with 20 units on screen

## Scope

### Included in Core Vision
- **AI-Powered Generation**: Drawing/text/upload → 64x64 skeletal-rigged sprite via PixelLab.ai
- **Intelligent Animation Mapping**: AI analyzes creatures and assigns from 50+ animation library
- **Comprehensive Animation Sets**: Movement, idle, death, attacks (melee/ranged/magic), special abilities
- **Drawing Personality Preservation**: Player's art style maintained in pixel art conversion
- **Multiplayer Battles**: Real-time room-based combat between players
- **Strategic Depth**: Placement, timing, and counter-play decisions
- **Creative Expression**: Every creature is unique and reflects player intent
- **Accessible Creation**: No artistic skill required to create compelling creatures

### Explicitly Excluded from MVP
- **Persistent Progression**: No leveling, unlocks, or account progression
- **Real-time Generation**: Players create creatures before battle, not during, but we will want this capability eventually. 
- **Custom Animation Creation**: Use pre-built library only, no user-created animations
- **Terrain Variety**: Flat battlefield only, no environmental effects
- **Spectator Mode**: Players can only watch their own matches
- **Mobile Clients**: Web-only for initial release

### Future Vision (Post-MVP)
- Real-time creature generation during battles
- Player-contributed animations to the library
- Complex ability interactions and synergies
- Tournament/ranked competitive modes
- Community creature sharing marketplace
- Mobile and desktop native clients

## Constraints

### Technical Constraints
- **Browser Limitations**: Must work in Chrome/Firefox/Safari without plugins
- **AI API Limits**: PixelLab.ai generation limits, animation processing capacity
- **Network Realities**: Design for 100ms+ latency between players
- **Rendering Budget**: PixiJS must handle desired unit counts

### Design Constraints
- **AI Unpredictability**: Embrace randomness as core fun, not a bug
- **Generation Failures**: Must gracefully handle AI refusing/failing
- **Copyright Safety**: Cannot reproduce copyrighted characters
- **Content Moderation**: Must handle inappropriate submissions

## Target Audience

## Core Experience Loop

1. **Imagine** - Player conceives a creature idea
2. **Create** - Draw on canvas, upload image, or describe in text
3. **Generate** - PixelLab.ai transforms input to 64x64 animated sprite with skeletal rigging
4. **Discover** - AI analyzes sprite and assigns animations from comprehensive library (20+ per creature)
5. **Preview** - Watch creature with idle, movement, attack, and special ability animations
6. **Deploy** - Strategic placement on battlefield
7. **Battle** - Watch creatures execute their full animation sets in combat
8. **Adapt** - Learn from results, imagine counters
9. **Share** - Show off unique creations to friends

## Emotional Journey

- **Anticipation**: "What will my dragon drawing become?"
- **Delight**: "It gave my stick figure laser eyes!"
- **Pride**: "My mushroom army is destroying their robots"
- **Curiosity**: "What if I draw a flying castle next?"
- **Connection**: "You have to see what the AI did with my cat drawing"

## Definition of "Good Enough" vs "Exceptional"

### Good Enough (MVP Target)
- Creatures generate consistently with full skeletal rigging via PixelLab.ai
- Every creature has minimum 5 animations (idle, move, attack, special, death)
- Animation mapping feels appropriate 90% of the time
- Basic combat showcases animation variety
- Two players can complete a full match
- Players voluntarily play multiple matches

### Exceptional (Vision Target)  
- Every creature feels uniquely "mine" with personality preserved from drawing
- 20+ animations per creature with seamless ability/attack synchronization
- Battles are visually spectacular with diverse animation combinations
- Players share creatures as social currency
- Community contributes animations to the shared library
- Real-time generation enables live audience participation
- Streamers adopt it as interactive content with viewers

## Key Design Principles

1. **Embrace the Chaos**: AI randomness is the fun, not a flaw to fix
2. **Fast to Fun**: Under 10 minutes from launch to first battle (including 2-5 minute generation with engaging progress feedback)
3. **Show, Don't Tell**: Visual feedback over text explanations
4. **Fail Gracefully**: Every AI failure becomes a "chaos spawn" opportunity
5. **Social First**: Built for sharing and playing with friends

## Technical Architecture Philosophy

- **Animation-First Design**: Every creature gets full animation set through intelligent mapping
- **Comprehensive Animation Library**: 50-100 base animations covering all creature types
- **Smart Fallbacks**: Procedural animations for edge cases (blob movement, particle deaths)
- **Cache Everything**: Every generation costs money, pre-generate common variants
- **Fail Fast**: Validate all inputs before expensive API calls
- **Hybrid Generation**: Pre-generate common creatures, on-demand for unique ones
- **Atomic Development**: Every feature independently testable

### Animation Architecture Note

**"Skeletal-Rigged Sprite" Terminology**: Throughout this document, references to "skeletal-rigged sprites" indicate that PixelLab.ai uses skeletal rigging technology internally during the animation generation process. This produces high-quality, smooth animations with proper movement physics. However, the output we receive from PixelLab.ai is **pre-rendered sprite frame arrays**, not skeletal rig data files. Our system uses these sprite frames in a hybrid animation architecture:

- **Base Animations**: Walk, idle, attack, death frames generated by PixelLab.ai
- **Effect Library**: Separate projectile, impact, and aura sprites managed by our system
- **Runtime Integration**: Effects spawned as game objects during creature attack animations

This sprite-based approach provides the flexibility needed for 50+ ability combinations while maintaining visual quality and performance on web browsers via PixiJS.

## Open Questions for Discovery

1. How many animations should be in our initial library (50, 75, 100+)?
2. Should animation assignment be purely rule-based or use AI classification?
3. How do we handle creatures that don't fit standard animation categories?
4. What's the right balance of unit count vs unit complexity?
5. Should we support team battles (2v2) in the future?
6. How do we handle offensive/inappropriate drawings?
7. When do we transition from pre-battle creation to real-time generation?

## Success Narrative

*"Two players boot up Drawn of War. Sarah draws a 'poison mushroom with legs' while Marcus types 'ancient stone golem'. They watch an engaging progress indicator as their creatures generate over 3-4 minutes—seeing skeletal rigging form, animations being assigned, and abilities being mapped. Their creatures materialize - Sarah's became a cluster of small toxic shrooms, Marcus's a single massive tank. They place their armies and watch as the mushrooms swarm the golem, which crushes several with each swing. Sarah's mushrooms eventually overwhelm the golem with poison damage. Both players immediately queue up again, Marcus now drawing 'fire-breathing chickens' to counter swarm strategies. They play for 2 hours, creating increasingly creative counters to each other's strategies, then share their favorite creatures on Discord."*

---

## Document Metadata

**Version**: 1.2
**Created**: 2024-01-27
**Last Updated**: 2025-09-29 (Added clarification on skeletal-rigged sprite terminology to prevent misunderstanding about PixelLab.ai output format)
**Author**: Product Visionary with Senior Engineering Input
**Status**: Ready for L1 Theme Development
**Review Cycle**: After each major playtest

## Acceptance Criteria for L1 Progression

Before moving to L1 Themes, ensure:
- [ ] All stakeholders have reviewed and signed off
- [ ] Technical constraints have been validated with POCs
- [ ] Budget mathematics confirmed sustainable
- [ ] Core loop tested with paper prototype
- [ ] Open questions have discovery plans