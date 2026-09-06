# gpt-5.5 / 03-kamae-ladder

Frozen benchmark output, expanded from the published artifact archive. Source and test bytes are unchanged.

[All implementations](../../README.md) · [Architecture comparison](../../../architecture-review.md) · [PRD](../../_inputs/PRD.md) · [API contract](../../_inputs/API.md)

Production: **3 files, 527 physical lines, 15,507 UTF-8 bytes**. Original acceptance checks: **19/19**. See the [experiment report](../../../report.md) for additional probes; passing the original checks is not a complete quality assessment.

[Generated design](DESIGN.md) · [Implementation notes](IMPLEMENTATION.md) · [Dependencies](package.json) · [Dependency lock](bun.lock) · [TypeScript configuration](tsconfig.json)

## Actual source layout

```text
src/
├── application/
│   └── validation.ts (224 lines)
├── domain/
│   └── expense.ts (121 lines)
├── index.test.ts (449 lines)
└── index.ts (182 lines)
```

## Source files

| File | Physical lines | Role |
| --- | ---: | --- |
| [src/application/validation.ts](src/application/validation.ts) | 224 | Production |
| [src/domain/expense.ts](src/domain/expense.ts) | 121 | Production |
| [src/index.test.ts](src/index.test.ts) | 449 | Generated test |
| [src/index.ts](src/index.ts) | 182 | Production |

## Run locally

From this directory, install the locked dependencies and run the generated checks:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test ./src
```

These commands run the generated tests, not the held-out acceptance suite or the post-hoc probes. Original measurement logs and frozen grader inputs remain in [artifacts.tar.gz](../../../artifacts.tar.gz).
