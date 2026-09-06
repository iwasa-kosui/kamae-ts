# gpt-5.5 / 01-kamae-ladder

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **10 files, 913 physical lines, 25,138 UTF-8 bytes**. Original acceptance checks: **19/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── application/
│   ├── commands.ts (64 lines)
│   └── use-cases.ts (175 lines)
├── domain/
│   ├── expense-resolver.ts (6 lines)
│   ├── expense-store.ts (5 lines)
│   ├── expense.ts (194 lines)
│   └── value-objects.ts (81 lines)
├── infrastructure/
│   ├── payment-codec.ts (19 lines)
│   └── storage-codec.ts (160 lines)
├── expense-service.test.ts (361 lines)
├── index.ts (192 lines)
└── result.ts (17 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/application/commands.ts](src/application/commands.ts) | 64 | Production |
| [src/application/use-cases.ts](src/application/use-cases.ts) | 175 | Production |
| [src/domain/expense-resolver.ts](src/domain/expense-resolver.ts) | 6 | Production |
| [src/domain/expense-store.ts](src/domain/expense-store.ts) | 5 | Production |
| [src/domain/expense.ts](src/domain/expense.ts) | 194 | Production |
| [src/domain/value-objects.ts](src/domain/value-objects.ts) | 81 | Production |
| [src/expense-service.test.ts](src/expense-service.test.ts) | 361 | Generated test |
| [src/index.ts](src/index.ts) | 192 | Production |
| [src/infrastructure/payment-codec.ts](src/infrastructure/payment-codec.ts) | 19 | Production |
| [src/infrastructure/storage-codec.ts](src/infrastructure/storage-codec.ts) | 160 | Production |
| [src/result.ts](src/result.ts) | 17 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
