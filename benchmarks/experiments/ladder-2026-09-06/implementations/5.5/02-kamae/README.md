# gpt-5.5 / 02-kamae

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **27 files, 963 physical lines, 31,898 UTF-8 bytes**. Original acceptance checks: **19/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── api/
│   ├── command.ts (61 lines)
│   ├── handle-command.ts (118 lines)
│   └── response.ts (66 lines)
├── domain/
│   ├── amount-cents.ts (16 lines)
│   ├── diagnostic-logger.ts (12 lines)
│   ├── employee-id.ts (11 lines)
│   ├── expense-by-id-resolver.ts (6 lines)
│   ├── expense-description.ts (15 lines)
│   ├── expense-id.ts (11 lines)
│   ├── expense-store.ts (5 lines)
│   ├── expense.ts (85 lines)
│   ├── owner-email.ts (15 lines)
│   ├── payment-gateway.ts (19 lines)
│   ├── receipt-id.ts (11 lines)
│   ├── rejection-reason.ts (11 lines)
│   └── sensitive.ts (17 lines)
├── storage/
│   ├── expense-record-mapper.ts (82 lines)
│   └── stored-expense.ts (68 lines)
├── support/
│   ├── assert-never.ts (3 lines)
│   └── schema-result.ts (17 lines)
├── use-cases/
│   ├── approve-expense.ts (39 lines)
│   ├── create-expense.ts (42 lines)
│   ├── get-expense.ts (18 lines)
│   ├── pay-expense.ts (47 lines)
│   ├── reject-expense.ts (41 lines)
│   └── submit-expense.ts (39 lines)
├── expense-service.test.ts (291 lines)
└── index.ts (88 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/api/command.ts](src/api/command.ts) | 61 | Production |
| [src/api/handle-command.ts](src/api/handle-command.ts) | 118 | Production |
| [src/api/response.ts](src/api/response.ts) | 66 | Production |
| [src/domain/amount-cents.ts](src/domain/amount-cents.ts) | 16 | Production |
| [src/domain/diagnostic-logger.ts](src/domain/diagnostic-logger.ts) | 12 | Production |
| [src/domain/employee-id.ts](src/domain/employee-id.ts) | 11 | Production |
| [src/domain/expense-by-id-resolver.ts](src/domain/expense-by-id-resolver.ts) | 6 | Production |
| [src/domain/expense-description.ts](src/domain/expense-description.ts) | 15 | Production |
| [src/domain/expense-id.ts](src/domain/expense-id.ts) | 11 | Production |
| [src/domain/expense-store.ts](src/domain/expense-store.ts) | 5 | Production |
| [src/domain/expense.ts](src/domain/expense.ts) | 85 | Production |
| [src/domain/owner-email.ts](src/domain/owner-email.ts) | 15 | Production |
| [src/domain/payment-gateway.ts](src/domain/payment-gateway.ts) | 19 | Production |
| [src/domain/receipt-id.ts](src/domain/receipt-id.ts) | 11 | Production |
| [src/domain/rejection-reason.ts](src/domain/rejection-reason.ts) | 11 | Production |
| [src/domain/sensitive.ts](src/domain/sensitive.ts) | 17 | Production |
| [src/expense-service.test.ts](src/expense-service.test.ts) | 291 | Generated test |
| [src/index.ts](src/index.ts) | 88 | Production |
| [src/storage/expense-record-mapper.ts](src/storage/expense-record-mapper.ts) | 82 | Production |
| [src/storage/stored-expense.ts](src/storage/stored-expense.ts) | 68 | Production |
| [src/support/assert-never.ts](src/support/assert-never.ts) | 3 | Production |
| [src/support/schema-result.ts](src/support/schema-result.ts) | 17 | Production |
| [src/use-cases/approve-expense.ts](src/use-cases/approve-expense.ts) | 39 | Production |
| [src/use-cases/create-expense.ts](src/use-cases/create-expense.ts) | 42 | Production |
| [src/use-cases/get-expense.ts](src/use-cases/get-expense.ts) | 18 | Production |
| [src/use-cases/pay-expense.ts](src/use-cases/pay-expense.ts) | 47 | Production |
| [src/use-cases/reject-expense.ts](src/use-cases/reject-expense.ts) | 41 | Production |
| [src/use-cases/submit-expense.ts](src/use-cases/submit-expense.ts) | 39 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
