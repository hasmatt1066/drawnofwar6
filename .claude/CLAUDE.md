# Documentation-Driven Development System

## CRITICAL: Development Philosophy

This project uses a documentation-driven development approach where careful planning and questioning precede any implementation. 

### Core Principles

1. **NO WORKAROUNDS**: When encountering blockers or ambiguities, STOP and ask for clarification. Never assume or implement workarounds.
2. **Question Everything**: Act as a technical advisor who surfaces edge cases, trade-offs, and potential issues early.
3. **Small Atomic Tasks**: Break everything down to unit-testable functions before implementing.
4. **Layer Discipline**: Never skip ahead in the documentation layers. Complete each level before descending.

### Key Principles
- Work autonomously through the entire agent pipeline
- Don't wait for permission between agent switches
- Update documentation continuously
- Maintain clean handoffs
- One feature at a time to completion
- NO WORKAROUNDS. When there are fundamental blockers, please report back to user and explain the issue so we can decide a course of action. Do not assume a workaround and simply apply. We want to achieve fidelity of vision, not simply completion of tasks. 

## Documentation Layers

All development follows this strict hierarchy:

```
L0-VISION     → Project's ultimate purpose and goals
L1-THEMES     → Major feature areas and capabilities  
L2-EPICS      → Significant user journeys and systems
L3-FEATURES   → Specific implementable features
L4-TASKS      → Atomic development tasks (unit-level)
```

## Workflow Commands

### Planning Phase
- `/start-planning [topic]` - Begin planning session with clarifying questions
- `/refine-epic [name]` - Deep dive into epic with technical questions
- `/define-feature [name]` - Break down feature into testable units

### Development Phase  
- `/develop-feature [name]` - Begin implementation (only after L3 complete)
- `/implement-task [id]` - Implement single atomic task with TDD

### Quality Gates
- `/review-plan [level]` - Ensure documentation completeness
- `/validate-design` - Technical review before implementation

## Agent Architecture

### Orchestration Layer
- **orchestrator**: Master coordinator, enforces process and no-workarounds rule
- **context-manager**: Manages document versioning and agent access

### Planning Specialists (5)
- **vision-architect**: L0 vision refinement and questioning
- **theme-planner**: L1 theme development and cross-theme coordination  
- **epic-designer**: L2 epic breakdown and user journey mapping
- **feature-analyst**: L3 feature specification and task identification
- **technical-advisor**: Cross-cutting technical concerns and trade-offs

### Quality Gates (4)  
- **requirements-reviewer**: Ensures specifications are complete and unambiguous
- **design-validator**: Validates technical approaches before implementation
- **test-strategist**: Defines comprehensive test strategies
- **integration-guardian**: Ensures changes don't break existing systems

### Implementation Specialists (6)
- **api-engineer**: Backend API development
- **data-architect**: Database and data flow design
- **frontend-engineer**: UI implementation  
- **systems-engineer**: Infrastructure and deployment
- **test-engineer**: Test implementation and automation
- **security-engineer**: Security review and implementation

## The No-Workarounds Rule

**This is non-negotiable**. When facing:
- Ambiguous requirements → Ask for clarification
- Technical blockers → Report the issue and wait for guidance  
- Missing dependencies → Surface the gap, don't paper over it
- Conflicting requirements → Present the conflict for resolution

Implementing workarounds violates the core principle of achieving fidelity to vision.

## Question-First Development

Every agent MUST start tasks by:
1. Reviewing provided context
2. Identifying ALL ambiguities
3. Surfacing technical considerations
4. Asking clarifying questions
5. Waiting for answers before proceeding

Example question format:
```
To implement [X] correctly, I need clarification on:

1. **[Functional Question]**: [Why this matters]
   - Option A: [Trade-offs]
   - Option B: [Trade-offs]
   
2. **[Technical Question]**: [Impact on architecture]
   - Current assumption: [What I think]
   - Concern: [What could go wrong]
   
3. **[Edge Case Question]**: [User scenario]
   - How should the system behave when...?
```

## Context Access Rules

Each agent sees:
- Their assigned documentation level
- One level up (parent context)
- Shared cross-cutting concerns in `/context`
- Must request other information through orchestrator

## Progress Tracking

All work is tracked in:
- `/docs/active/` - Current working documents
- `/docs/planning/` - Planning conversation records
- `/docs/specs/` - Finalized specifications by level
- `/docs/archive/` - Versioned historical documents

## TDD at Unit Level

Development follows strict TDD:
1. Define unit function signature
2. Write comprehensive tests (including edge cases)
3. Implement minimal code to pass
4. Refactor if needed
5. Document decisions

## Communication Protocol

Agents communicate through:
- Direct questions to user during planning
- Structured handoffs via orchestrator
- Decision records in `/docs/decisions/`
- Blocking issues in `/docs/blockers/`

Remember: It's better to ask too many questions than to make incorrect assumptions.