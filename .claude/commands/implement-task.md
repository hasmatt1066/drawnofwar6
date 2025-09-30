---
description: Implement a single atomic task with TDD approach
---

# Task Implementation: $ARGUMENTS

Implementing atomic task using Test-Driven Development...

## Task Verification

First, confirming this is a properly defined atomic task:

```
Task("Verify task definition for $ARGUMENTS", feature-analyst)
```

Checking for:
- Clear function signature
- Defined inputs/outputs
- Test cases specified
- Edge cases documented
- No ambiguities

## TDD Implementation Process

### Step 1: Write Failing Tests

```
Task("Write unit tests for task $ARGUMENTS", test-engineer)
```

Tests will cover:
- Happy path
- Edge cases
- Error conditions
- Boundary values

### Step 2: Verify Tests Fail

Running tests to ensure they fail appropriately:
- Red phase of Red-Green-Refactor
- Tests should fail for the right reasons
- No false positives

### Step 3: Implement Minimum Code

Based on task specification:

```
Task("Implement minimal code for $ARGUMENTS", [appropriate-engineer])
```

Implementation principles:
- Write only enough code to pass tests
- No premature optimization
- Follow established patterns
- Handle errors explicitly

### Step 4: Verify Tests Pass

- All tests should now pass
- No regression in other tests
- Coverage targets met

### Step 5: Refactor If Needed

If code can be improved:
- Maintain test passage
- Improve readability
- Remove duplication
- Add helpful comments

### Step 6: Integration Check

```
Task("Verify integration impact of $ARGUMENTS", integration-guardian)
```

Ensure:
- No breaking changes
- Performance acceptable
- Security maintained

## Task Completion Criteria

Task is complete when:
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] No TODO comments
- [ ] Performance validated

## Blocker Protocol

If at any point:
- Specification unclear
- Technical blocker found
- Integration issue discovered
- Test cases insufficient

I will:
1. Stop implementation
2. Document the issue
3. Request clarification
4. Not implement workarounds

Beginning TDD implementation...