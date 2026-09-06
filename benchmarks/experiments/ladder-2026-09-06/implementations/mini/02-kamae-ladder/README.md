# gpt-5.4-mini / 02-kamae-ladder

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **8 files, 700 physical lines, 20,025 UTF-8 bytes**. Original acceptance checks: **18/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── domain/
│   ├── command.ts (169 lines)
│   ├── email-address.ts (14 lines)
│   ├── employee-id.ts (15 lines)
│   ├── errors.ts (21 lines)
│   ├── expense-id.ts (15 lines)
│   ├── expense.ts (211 lines)
│   └── response.ts (47 lines)
├── index.test.ts (408 lines)
└── index.ts (208 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/domain/command.ts](src/domain/command.ts) | 169 | Production |
| [src/domain/email-address.ts](src/domain/email-address.ts) | 14 | Production |
| [src/domain/employee-id.ts](src/domain/employee-id.ts) | 15 | Production |
| [src/domain/errors.ts](src/domain/errors.ts) | 21 | Production |
| [src/domain/expense-id.ts](src/domain/expense-id.ts) | 15 | Production |
| [src/domain/expense.ts](src/domain/expense.ts) | 211 | Production |
| [src/domain/response.ts](src/domain/response.ts) | 47 | Production |
| [src/index.test.ts](src/index.test.ts) | 408 | Generated test |
| [src/index.ts](src/index.ts) | 208 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
