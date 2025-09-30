---
description: Begin feature implementation after L3 documentation is complete
---

# Feature Development: $ARGUMENTS

Checking if feature is ready for implementation...

## Pre-Implementation Verification

```
Task("Verify L3 documentation complete for $ARGUMENTS", requirements-reviewer)
Task("Check all prerequisites met for $ARGUMENTS", orchestrator)
```

## Implementation Blocked Check

If documentation is incomplete or unclear, I will:
1. Stop the implementation process
2. Report what's missing or ambiguous
3. Ask for clarification
4. Wait for your guidance

**Remember: No workarounds. We implement only what's clearly specified.**

## Implementation Process (If Approved)

### Phase 1: Final Review
- Confirm all atomic tasks defined
- Verify test cases documented
- Check integration points clear
- Ensure no ambiguities remain

### Phase 2: Test Development
Following TDD principles:

```
Task("Write unit tests for $ARGUMENTS", test-engineer)
Task("Write integration tests for $ARGUMENTS", test-engineer)
```

### Phase 3: Implementation
After tests are written and failing:

```
Task("Implement API endpoints for $ARGUMENTS", api-engineer)
Task("Implement data layer for $ARGUMENTS", data-architect)
Task("Implement frontend for $ARGUMENTS", frontend-engineer)
Task("Configure infrastructure for $ARGUMENTS", systems-engineer)
```

### Phase 4: Security Review
Before considering complete:

```
Task("Security review for $ARGUMENTS", security-engineer)
Task("Verify secure coding practices", security-engineer)
```

### Phase 5: Integration Testing
Ensure everything works together:

```
Task("Run integration test suite", test-engineer)
Task("Verify system integration", integration-guardian)
```

### Phase 6: Documentation Update
Keep documentation current:

```
Task("Update technical documentation", context-manager)
Task("Document decisions and trade-offs", orchestrator)
```

## Quality Gates

Implementation must pass:
- [ ] All tests passing (unit, integration, e2e)
- [ ] Code review approved
- [ ] Security scan clean
- [ ] Performance targets met
- [ ] Documentation updated

## If Blocked

At any point, if we encounter:
- Unclear requirements
- Technical blockers
- Missing dependencies
- Ambiguous specifications

We will:
1. Stop immediately
2. Document the blocker
3. Request clarification
4. Not proceed until resolved

Beginning development process verification...