# gpt-5.5 / 01-kamae

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **28 files, 1,054 physical lines, 32,165 UTF-8 bytes**. Original acceptance checks: **19/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── api/
│   ├── adapters.ts (67 lines)
│   ├── commands.ts (74 lines)
│   ├── dependencies.ts (31 lines)
│   ├── handle.ts (157 lines)
│   ├── responses.ts (58 lines)
│   └── storage-expense.ts (112 lines)
├── application/
│   ├── approve-expense.ts (43 lines)
│   ├── create-expense.ts (34 lines)
│   ├── get-expense.ts (15 lines)
│   ├── pay-expense.ts (48 lines)
│   ├── reject-expense.ts (43 lines)
│   └── submit-expense.ts (43 lines)
├── domain/
│   └── expense/
│       ├── amount-cents.ts (17 lines)
│       ├── description.ts (15 lines)
│       ├── employee-id.ts (12 lines)
│       ├── expense-by-id-resolver.ts (6 lines)
│       ├── expense-id.ts (12 lines)
│       ├── expense-logger.ts (9 lines)
│       ├── expense-payment-gateway.ts (9 lines)
│       ├── expense-store.ts (5 lines)
│       ├── expense.ts (147 lines)
│       ├── owner-email.ts (19 lines)
│       ├── receipt-id.ts (15 lines)
│       └── rejection-reason.ts (15 lines)
├── shared/
│   ├── assert-never.ts (3 lines)
│   ├── sensitive.ts (19 lines)
│   └── validation.ts (13 lines)
├── index.test.ts (420 lines)
└── index.ts (13 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/api/adapters.ts](src/api/adapters.ts) | 67 | Production |
| [src/api/commands.ts](src/api/commands.ts) | 74 | Production |
| [src/api/dependencies.ts](src/api/dependencies.ts) | 31 | Production |
| [src/api/handle.ts](src/api/handle.ts) | 157 | Production |
| [src/api/responses.ts](src/api/responses.ts) | 58 | Production |
| [src/api/storage-expense.ts](src/api/storage-expense.ts) | 112 | Production |
| [src/application/approve-expense.ts](src/application/approve-expense.ts) | 43 | Production |
| [src/application/create-expense.ts](src/application/create-expense.ts) | 34 | Production |
| [src/application/get-expense.ts](src/application/get-expense.ts) | 15 | Production |
| [src/application/pay-expense.ts](src/application/pay-expense.ts) | 48 | Production |
| [src/application/reject-expense.ts](src/application/reject-expense.ts) | 43 | Production |
| [src/application/submit-expense.ts](src/application/submit-expense.ts) | 43 | Production |
| [src/domain/expense/amount-cents.ts](src/domain/expense/amount-cents.ts) | 17 | Production |
| [src/domain/expense/description.ts](src/domain/expense/description.ts) | 15 | Production |
| [src/domain/expense/employee-id.ts](src/domain/expense/employee-id.ts) | 12 | Production |
| [src/domain/expense/expense-by-id-resolver.ts](src/domain/expense/expense-by-id-resolver.ts) | 6 | Production |
| [src/domain/expense/expense-id.ts](src/domain/expense/expense-id.ts) | 12 | Production |
| [src/domain/expense/expense-logger.ts](src/domain/expense/expense-logger.ts) | 9 | Production |
| [src/domain/expense/expense-payment-gateway.ts](src/domain/expense/expense-payment-gateway.ts) | 9 | Production |
| [src/domain/expense/expense-store.ts](src/domain/expense/expense-store.ts) | 5 | Production |
| [src/domain/expense/expense.ts](src/domain/expense/expense.ts) | 147 | Production |
| [src/domain/expense/owner-email.ts](src/domain/expense/owner-email.ts) | 19 | Production |
| [src/domain/expense/receipt-id.ts](src/domain/expense/receipt-id.ts) | 15 | Production |
| [src/domain/expense/rejection-reason.ts](src/domain/expense/rejection-reason.ts) | 15 | Production |
| [src/index.test.ts](src/index.test.ts) | 420 | Generated test |
| [src/index.ts](src/index.ts) | 13 | Production |
| [src/shared/assert-never.ts](src/shared/assert-never.ts) | 3 | Production |
| [src/shared/sensitive.ts](src/shared/sensitive.ts) | 19 | Production |
| [src/shared/validation.ts](src/shared/validation.ts) | 13 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
