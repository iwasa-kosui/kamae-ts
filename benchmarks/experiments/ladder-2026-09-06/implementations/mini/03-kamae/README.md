# gpt-5.4-mini / 03-kamae

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **11 files, 883 physical lines, 23,255 UTF-8 bytes**. Original acceptance checks: **18/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── assert-never.ts (3 lines)
├── command.ts (179 lines)
├── email-address.ts (11 lines)
├── employee-id.ts (9 lines)
├── expense-id.ts (9 lines)
├── expense-service.test.ts (376 lines)
├── expense-service.ts (406 lines)
├── expense.ts (123 lines)
├── index.ts (1 lines)
├── logger-event.ts (33 lines)
├── public-expense.ts (100 lines)
└── receipt-id.ts (9 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/assert-never.ts](src/assert-never.ts) | 3 | Production |
| [src/command.ts](src/command.ts) | 179 | Production |
| [src/email-address.ts](src/email-address.ts) | 11 | Production |
| [src/employee-id.ts](src/employee-id.ts) | 9 | Production |
| [src/expense-id.ts](src/expense-id.ts) | 9 | Production |
| [src/expense-service.test.ts](src/expense-service.test.ts) | 376 | Generated test |
| [src/expense-service.ts](src/expense-service.ts) | 406 | Production |
| [src/expense.ts](src/expense.ts) | 123 | Production |
| [src/index.ts](src/index.ts) | 1 | Production |
| [src/logger-event.ts](src/logger-event.ts) | 33 | Production |
| [src/public-expense.ts](src/public-expense.ts) | 100 | Production |
| [src/receipt-id.ts](src/receipt-id.ts) | 9 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
