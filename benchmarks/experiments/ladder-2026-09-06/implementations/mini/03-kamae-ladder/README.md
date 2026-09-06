# gpt-5.4-mini / 03-kamae-ladder

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **4 files, 826 physical lines, 20,849 UTF-8 bytes**. Original acceptance checks: **18/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── command.ts (204 lines)
├── expense-service.test.ts (452 lines)
├── expense.ts (294 lines)
├── index.ts (2 lines)
└── service.ts (326 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/command.ts](src/command.ts) | 204 | Production |
| [src/expense-service.test.ts](src/expense-service.test.ts) | 452 | Generated test |
| [src/expense.ts](src/expense.ts) | 294 | Production |
| [src/index.ts](src/index.ts) | 2 | Production |
| [src/service.ts](src/service.ts) | 326 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
