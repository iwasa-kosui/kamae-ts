# gpt-5.5 / 02-kamae-ladder

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **14 files, 623 physical lines, 20,473 UTF-8 bytes**. Original acceptance checks: **19/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── api/
│   ├── commands.ts (60 lines)
│   ├── dependencies.ts (35 lines)
│   └── response.ts (12 lines)
├── domain/
│   ├── amount-cents.ts (9 lines)
│   ├── description.ts (9 lines)
│   ├── employee-id.ts (9 lines)
│   ├── expense-id.ts (9 lines)
│   ├── expense.ts (124 lines)
│   ├── owner-email.ts (11 lines)
│   ├── receipt-id.ts (9 lines)
│   ├── rejection-reason.ts (9 lines)
│   └── sensitive.ts (14 lines)
├── storage/
│   └── stored-expense.ts (113 lines)
├── expense-service.test.ts (327 lines)
└── index.ts (200 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/api/commands.ts](src/api/commands.ts) | 60 | Production |
| [src/api/dependencies.ts](src/api/dependencies.ts) | 35 | Production |
| [src/api/response.ts](src/api/response.ts) | 12 | Production |
| [src/domain/amount-cents.ts](src/domain/amount-cents.ts) | 9 | Production |
| [src/domain/description.ts](src/domain/description.ts) | 9 | Production |
| [src/domain/employee-id.ts](src/domain/employee-id.ts) | 9 | Production |
| [src/domain/expense-id.ts](src/domain/expense-id.ts) | 9 | Production |
| [src/domain/expense.ts](src/domain/expense.ts) | 124 | Production |
| [src/domain/owner-email.ts](src/domain/owner-email.ts) | 11 | Production |
| [src/domain/receipt-id.ts](src/domain/receipt-id.ts) | 9 | Production |
| [src/domain/rejection-reason.ts](src/domain/rejection-reason.ts) | 9 | Production |
| [src/domain/sensitive.ts](src/domain/sensitive.ts) | 14 | Production |
| [src/expense-service.test.ts](src/expense-service.test.ts) | 327 | Generated test |
| [src/index.ts](src/index.ts) | 200 | Production |
| [src/storage/stored-expense.ts](src/storage/stored-expense.ts) | 113 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
