---
description: Validate technical design before implementation begins
---

# Design Validation: $ARGUMENTS

Conducting technical design validation to ensure the approach is sound before implementation...

## Validation Scope

Reviewing technical design for:
- Architectural patterns
- Technology choices
- Integration approach
- Performance implications
- Security considerations

## Validation Process

### Step 1: Design Document Review

```
Task("Load technical design for $ARGUMENTS", context-manager)
Task("Initial design assessment for $ARGUMENTS", design-validator)
```

### Step 2: Architecture Analysis

The design validator will examine:
- Component responsibilities
- Data flow patterns
- Service boundaries
- Coupling and cohesion
- Scalability approach

### Step 3: Risk Assessment

```
Task("Identify technical risks in $ARGUMENTS design", technical-advisor)
```

Evaluating:
- Single points of failure
- Performance bottlenecks
- Security vulnerabilities
- Maintenance complexity
- Technical debt potential

### Step 4: Alternative Analysis

```
Task("Consider alternative approaches for $ARGUMENTS", technical-advisor)
```

Comparing:
- Current design pros/cons
- Alternative approaches
- Trade-off analysis
- Recommendation rationale

### Step 5: Integration Impact

```
Task("Assess integration impact of $ARGUMENTS design", integration-guardian)
```

Checking:
- API compatibility
- Data model changes
- Performance impact
- Deployment complexity

## Validation Criteria

Design must satisfy:

### Functional Requirements
- [ ] Meets all specified requirements
- [ ] Handles all use cases
- [ ] Addresses edge cases

### Non-Functional Requirements
- [ ] Performance targets achievable
- [ ] Security requirements met
- [ ] Scalability path clear
- [ ] Maintainability acceptable

### Best Practices
- [ ] SOLID principles followed
- [ ] DRY (Don't Repeat Yourself)
- [ ] KISS (Keep It Simple)
- [ ] YAGNI (You Aren't Gonna Need It)

## Validation Report

Will include:

### Overall Assessment
- Risk Level: [Low/Medium/High]
- Complexity: [Simple/Moderate/Complex]
- Recommendation: [Proceed/Revise/Reconsider]

### Specific Findings
1. **Strengths**: What's well designed
2. **Concerns**: Potential issues
3. **Risks**: What could go wrong
4. **Recommendations**: How to improve

### Required Changes
- Critical: Must fix before implementation
- Important: Should address
- Optional: Consider for future

## Decision Point

Based on validation:
- **Approved**: Design is sound, can proceed
- **Conditional**: Minor changes needed
- **Rejected**: Major redesign required

Starting design validation...