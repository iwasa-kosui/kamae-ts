# gpt-5.5 / 03-kamae

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **29 files, 1,050 physical lines, 30,856 UTF-8 bytes**. Original acceptance checks: **19/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── application/
│   ├── approve-expense.ts (38 lines)
│   ├── create-expense.ts (43 lines)
│   ├── get-expense.ts (16 lines)
│   ├── logger.ts (13 lines)
│   ├── pay-expense.ts (43 lines)
│   ├── payment-charger.ts (20 lines)
│   ├── reject-expense.ts (40 lines)
│   └── submit-expense.ts (38 lines)
├── domain/
│   └── expense/
│       ├── amount-cents.ts (19 lines)
│       ├── assert-never.ts (4 lines)
│       ├── description.ts (17 lines)
│       ├── email-address.ts (23 lines)
│       ├── employee-id.ts (17 lines)
│       ├── expense-by-id-resolver.ts (7 lines)
│       ├── expense-codec.ts (117 lines)
│       ├── expense-id.ts (17 lines)
│       ├── expense-store.ts (6 lines)
│       ├── expense.ts (113 lines)
│       ├── receipt-id.ts (17 lines)
│       ├── rejection-reason.ts (17 lines)
│       ├── sensitive.ts (18 lines)
│       └── validation.ts (14 lines)
├── infrastructure/
│   ├── host-logger.ts (17 lines)
│   ├── host-payment.ts (44 lines)
│   └── host-repository.ts (23 lines)
├── service/
│   ├── command.ts (50 lines)
│   ├── expense-service.ts (131 lines)
│   └── response.ts (91 lines)
├── expense-service.test.ts (359 lines)
└── index.ts (37 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/application/approve-expense.ts](src/application/approve-expense.ts) | 38 | Production |
| [src/application/create-expense.ts](src/application/create-expense.ts) | 43 | Production |
| [src/application/get-expense.ts](src/application/get-expense.ts) | 16 | Production |
| [src/application/logger.ts](src/application/logger.ts) | 13 | Production |
| [src/application/pay-expense.ts](src/application/pay-expense.ts) | 43 | Production |
| [src/application/payment-charger.ts](src/application/payment-charger.ts) | 20 | Production |
| [src/application/reject-expense.ts](src/application/reject-expense.ts) | 40 | Production |
| [src/application/submit-expense.ts](src/application/submit-expense.ts) | 38 | Production |
| [src/domain/expense/amount-cents.ts](src/domain/expense/amount-cents.ts) | 19 | Production |
| [src/domain/expense/assert-never.ts](src/domain/expense/assert-never.ts) | 4 | Production |
| [src/domain/expense/description.ts](src/domain/expense/description.ts) | 17 | Production |
| [src/domain/expense/email-address.ts](src/domain/expense/email-address.ts) | 23 | Production |
| [src/domain/expense/employee-id.ts](src/domain/expense/employee-id.ts) | 17 | Production |
| [src/domain/expense/expense-by-id-resolver.ts](src/domain/expense/expense-by-id-resolver.ts) | 7 | Production |
| [src/domain/expense/expense-codec.ts](src/domain/expense/expense-codec.ts) | 117 | Production |
| [src/domain/expense/expense-id.ts](src/domain/expense/expense-id.ts) | 17 | Production |
| [src/domain/expense/expense-store.ts](src/domain/expense/expense-store.ts) | 6 | Production |
| [src/domain/expense/expense.ts](src/domain/expense/expense.ts) | 113 | Production |
| [src/domain/expense/receipt-id.ts](src/domain/expense/receipt-id.ts) | 17 | Production |
| [src/domain/expense/rejection-reason.ts](src/domain/expense/rejection-reason.ts) | 17 | Production |
| [src/domain/expense/sensitive.ts](src/domain/expense/sensitive.ts) | 18 | Production |
| [src/domain/expense/validation.ts](src/domain/expense/validation.ts) | 14 | Production |
| [src/expense-service.test.ts](src/expense-service.test.ts) | 359 | Generated test |
| [src/index.ts](src/index.ts) | 37 | Production |
| [src/infrastructure/host-logger.ts](src/infrastructure/host-logger.ts) | 17 | Production |
| [src/infrastructure/host-payment.ts](src/infrastructure/host-payment.ts) | 44 | Production |
| [src/infrastructure/host-repository.ts](src/infrastructure/host-repository.ts) | 23 | Production |
| [src/service/command.ts](src/service/command.ts) | 50 | Production |
| [src/service/expense-service.ts](src/service/expense-service.ts) | 131 | Production |
| [src/service/response.ts](src/service/response.ts) | 91 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
