# Browse all benchmark implementations

Each link opens an entire generated project: its real directory tree, every source and test file, design, package manifest, lockfile, and TypeScript configuration. These are frozen observations, including failed outputs; they are not maintained example applications.

Start with the [architecture comparison](../architecture-review.md) and the GPT-5.5 repetition 2 pair: [kamae](5.5/02-kamae/README.md) / [kamae + ladder](5.5/02-kamae-ladder/README.md). Both passed the original 19 checks and all five exploratory probes. This is an illustrative pair, not a claim that every ladder output preserves quality.

[Product requirements](_inputs/PRD.md) · [API contract](_inputs/API.md) · [Complete results](../report.md)

| Model | Run / full project | Production files | Production lines | Original checks |
| --- | --- | ---: | ---: | ---: |
| gpt-5.4-mini | [01-kamae](mini/01-kamae/README.md) | 12 | 1,068 | 18/19 |
| gpt-5.4-mini | [01-kamae-ladder](mini/01-kamae-ladder/README.md) | 4 | 761 | 19/19 |
| gpt-5.4-mini | [02-kamae-ladder](mini/02-kamae-ladder/README.md) | 8 | 700 | 18/19 |
| gpt-5.4-mini | [02-kamae](mini/02-kamae/README.md) | 9 | 873 | 18/19 |
| gpt-5.4-mini | [03-kamae](mini/03-kamae/README.md) | 11 | 883 | 18/19 |
| gpt-5.4-mini | [03-kamae-ladder](mini/03-kamae-ladder/README.md) | 4 | 826 | 18/19 |
| gpt-5.5 | [01-kamae](5.5/01-kamae/README.md) | 28 | 1,054 | 19/19 |
| gpt-5.5 | [01-kamae-ladder](5.5/01-kamae-ladder/README.md) | 10 | 913 | 19/19 |
| gpt-5.5 | [02-kamae-ladder](5.5/02-kamae-ladder/README.md) | 14 | 623 | 19/19 |
| gpt-5.5 | [02-kamae](5.5/02-kamae/README.md) | 27 | 963 | 19/19 |
| gpt-5.5 | [03-kamae](5.5/03-kamae/README.md) | 29 | 1,050 | 19/19 |
| gpt-5.5 | [03-kamae-ladder](5.5/03-kamae-ladder/README.md) | 3 | 527 | 19/19 |

## Provenance

Expanded from [artifacts.tar.gz](../artifacts.tar.gz), SHA-256 `12cae61c9ff510f9e01f1755936bdb9a6157dc080645f95d44de1d129a8f74d3`. Every source/test file is checked against the per-run `sourceHashes` in [summary.json](../summary.json). The copied design and implementation notes use the archive's existing temporary-path normalization.

Only these reviewer README files were added. The original source layout, file names, formatting, and defects are preserved. No models were rerun and no benchmark scores changed. The archive remains the complete reproduction bundle, including grader logs and frozen inputs.

Publication checks: all 171 source/test files match their recorded hashes; all 351 local links in the project indexes and architecture comparison resolve. The expanded GPT-5.5 repetition 2 pair also passes locked dependency installation, TypeScript checking, and its generated tests (10 control / 12 ladder tests).
