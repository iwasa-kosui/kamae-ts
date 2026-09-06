# gpt-5.4-mini / 01-kamae-ladder

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **4 files, 761 physical lines, 22,155 UTF-8 bytes**. Original acceptance checks: **19/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── expense.ts (332 lines)
├── index.ts (1 lines)
├── service.test.ts (350 lines)
├── service.ts (252 lines)
└── validation.ts (176 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/expense.ts](src/expense.ts) | 332 | Production |
| [src/index.ts](src/index.ts) | 1 | Production |
| [src/service.test.ts](src/service.test.ts) | 350 | Generated test |
| [src/service.ts](src/service.ts) | 252 | Production |
| [src/validation.ts](src/validation.ts) | 176 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
