# gpt-5.4-mini / 02-kamae

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **9 files, 873 physical lines, 24,747 UTF-8 bytes**. Original acceptance checks: **18/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── commands.ts (178 lines)
├── employee-id.ts (18 lines)
├── expense-id.ts (16 lines)
├── expense.ts (150 lines)
├── index.ts (3 lines)
├── record.ts (153 lines)
├── result.ts (19 lines)
├── service.test.ts (364 lines)
├── service.ts (291 lines)
└── validation.ts (45 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/commands.ts](src/commands.ts) | 178 | Production |
| [src/employee-id.ts](src/employee-id.ts) | 18 | Production |
| [src/expense-id.ts](src/expense-id.ts) | 16 | Production |
| [src/expense.ts](src/expense.ts) | 150 | Production |
| [src/index.ts](src/index.ts) | 3 | Production |
| [src/record.ts](src/record.ts) | 153 | Production |
| [src/result.ts](src/result.ts) | 19 | Production |
| [src/service.test.ts](src/service.test.ts) | 364 | Generated test |
| [src/service.ts](src/service.ts) | 291 | Production |
| [src/validation.ts](src/validation.ts) | 45 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
