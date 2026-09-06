# gpt-5.4-mini / 01-kamae

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **12 files, 1,068 physical lines, 31,543 UTF-8 bytes**. Original acceptance checks: **18/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── amount-cents.ts (32 lines)
├── brand.ts (11 lines)
├── command.ts (204 lines)
├── email-address.ts (34 lines)
├── employee-id.ts (32 lines)
├── expense-description.ts (32 lines)
├── expense-id.ts (32 lines)
├── expense.ts (281 lines)
├── index.ts (1 lines)
├── result.ts (17 lines)
├── service.test.ts (438 lines)
├── service.ts (327 lines)
└── validation.ts (65 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/amount-cents.ts](src/amount-cents.ts) | 32 | Production |
| [src/brand.ts](src/brand.ts) | 11 | Production |
| [src/command.ts](src/command.ts) | 204 | Production |
| [src/email-address.ts](src/email-address.ts) | 34 | Production |
| [src/employee-id.ts](src/employee-id.ts) | 32 | Production |
| [src/expense-description.ts](src/expense-description.ts) | 32 | Production |
| [src/expense-id.ts](src/expense-id.ts) | 32 | Production |
| [src/expense.ts](src/expense.ts) | 281 | Production |
| [src/index.ts](src/index.ts) | 1 | Production |
| [src/result.ts](src/result.ts) | 17 | Production |
| [src/service.test.ts](src/service.test.ts) | 438 | Generated test |
| [src/service.ts](src/service.ts) | 327 | Production |
| [src/validation.ts](src/validation.ts) | 65 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
