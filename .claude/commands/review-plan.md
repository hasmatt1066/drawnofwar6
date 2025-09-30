---
description: Review and validate planning documentation at a specific level
---

# Planning Review: $ARGUMENTS

Conducting comprehensive review of planning documentation...

## Review Scope

Determining which level to review based on "$ARGUMENTS":
- L0 Vision completeness
- L1 Themes coherence
- L2 Epics detail
- L3 Features specification

## Review Process

### Step 1: Gather Documentation

```
Task("Collect all $ARGUMENTS level documentation", context-manager)
```

### Step 2: Completeness Check

```
Task("Review $ARGUMENTS documentation completeness", requirements-reviewer)
```

Checking for:
- All required sections present
- No ambiguous statements
- Clear success criteria
- Testable requirements
- Complete edge case coverage

### Step 3: Technical Validation

```
Task("Validate technical approach in $ARGUMENTS", design-validator)
```

Ensuring:
- Architectural soundness
- Scalability considered
- Security addressed
- Performance targets realistic
- Integration points clear

### Step 4: Dependency Analysis

```
Task("Analyze dependencies for $ARGUMENTS", integration-guardian)
```

Verifying:
- All dependencies identified
- No circular dependencies
- External dependencies documented
- Version requirements clear

### Step 5: Test Strategy Review

```
Task("Review test strategy for $ARGUMENTS", test-strategist)
```

Confirming:
- Test scenarios comprehensive
- Edge cases covered
- Performance tests planned
- Security tests included

## Review Report

The review will produce:

### Completeness Score
- Documentation: X/10
- Clarity: X/10
- Testability: X/10
- Technical Detail: X/10

### Findings
1. **Critical Issues** (Must fix before proceeding)
2. **Major Gaps** (Should address)
3. **Minor Improvements** (Nice to have)
4. **Recommendations** (Future considerations)

### Sign-off Checklist
- [ ] All critical issues resolved
- [ ] Major gaps addressed
- [ ] Technical approach validated
- [ ] Dependencies mapped
- [ ] Test strategy complete

## Next Steps

Based on review:
- If approved: Can proceed to next level
- If gaps found: Specific items to address
- If blocked: Major issues requiring resolution

Starting documentation review...