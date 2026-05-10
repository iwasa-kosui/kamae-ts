---
name: functional-ts-review
description: Use when reviewing TypeScript server-side code for adherence to functional domain modeling principles. Checks for class usage, method notation, interface declarations, type assertions, thrown exceptions, missing exhaustiveness checks, and PII protection.
license: MIT
---

# Functional TypeScript Code Review

Review server-side TypeScript code against functional domain modeling principles.

## Review Procedure

1. Read the files under review
2. Scan through the checklist items below in order
3. When a violation is found, report it with the relevant principle and the reason it matters
4. When something is not a violation but has room for improvement, communicate it as a suggestion

## Checklist

### 1. Are classes used for domain models?

If `class` is used to define domain entities or value objects, suggest migrating to the Discriminated Union + Companion Object pattern.

Using class inheritance required by an external library is a legitimate exception.

### 2. Is method notation used?

If functions inside type definitions use method notation (`save(task: Task): Promise<void>`), flag it and suggest function property notation (`save: (task: Task) => Promise<void>`).

Method notation makes parameter types bivariant, allowing a narrower implementation (e.g., `save(task: DoingTask): Promise<void>`) to pass type checking at dependency injection sites.

### 3. Is `interface` used for domain types?

Declaration merging with `interface` means that declaring an interface of the same name in another file silently alters the type's shape. Domain types should be defined with `type`.

`interface` is required for library type augmentation, which is a legitimate use case.

### 4. Are there `as` type assertions?

`as` bypasses type checking. Verify the following:
- External data: is it parsed with a validation schema (Zod, Valibot, or ArkType)?
- `as` inside Branded Type factory functions: acceptable (the only exception)
- Everything else: consider whether type inference can resolve it instead

### 5. Are exceptions thrown in the domain layer?

If `throw` is used in the domain layer (entities, use cases), suggest migrating to the `Result` type.

The following are acceptable:
- `throw` inside `assertNever` (unreachable code detection)
- Unexpected failures in the infrastructure layer

### 6. Do switch statements have assertNever?

If a `switch` branching on a Discriminated Union lacks `default: return assertNever(x)`, flag it. Without it, adding a new variant will not produce a compile error.

### 7. Is there schema validation at external boundaries?

At external boundaries such as API handlers, DB result mapping, and config file loading, check that raw data is not treated as domain types without validation. The project should use a validation library (Zod, Valibot, or ArkType) to parse external data.

### 8. Do PII fields have Sensitive wrappers?

Check that fields containing personal information (name, email address, phone number, diagnostic information, etc.) are wrapped with `Sensitive<T>`. Pay particular attention to objects that may appear in logs.

## How to Write Findings

Each finding should include:

1. **What the problem is**: the specific location in the code
2. **Why it is a problem**: the principle and the risk of violating it
3. **How to fix it**: a code example showing the corrected version

```
### Use of method notation

`src/repository/task-repository.ts:15`

`save(task: Task): Promise<void>` uses method notation. With method notation, parameter types become
bivariant, so a narrower implementation such as `save(task: DoingTask): Promise<void>` will pass
type checking.

Suggested fix:
\`\`\`typescript
type TaskRepository = {
  save: (task: Task) => Promise<void>;
};
\`\`\`
```

## Severity

Each checklist item has the following severity:

| Severity | Item | Reason |
|----------|------|--------|
| High | `as` type assertions | Direct cause of runtime errors |
| High | Unprotected PII | Risk of compliance violations |
| High | Missing schema validation at external boundaries | Direct cause of runtime errors |
| Medium | Class usage | Reduced type safety when extended |
| Medium | Use of throw | Consistency of error handling |
| Medium | Missing assertNever | Overlooked cases when new variants are added |
| Low | Method notation | Issue only manifests under specific conditions |
| Low | Interface usage | Declaration merging accidents are rare |
