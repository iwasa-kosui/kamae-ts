# Add `kamae-review` to installation guidance

## Context

The public installation guidance explains that `kamae-review` depends on
`kamae`, but every `gh skill install` example installs only `kamae`. This
leaves users without a concrete command for enabling the review skill and
makes the verification guidance incomplete.

## Decision

Keep `gh skill` as the primary installation path. Show `kamae` and
`kamae-review` together in every applicable `gh skill` example so users can
install both skills with the same agent, scope, and release choices.

Do not promote `npx skills add` to the primary path. It remains the existing
repository-wide alternative.

## Public surfaces

Update these five files in sync:

- `docs/index.md`
- `docs/en/installation.md`
- `docs/ja/installation.md`
- `README.md`
- `README.ja.md`

## Content changes

- Add a `kamae-review` command after the existing `kamae` command on the
  landing page.
- In both detailed installation pages and both READMEs, add matching
  `kamae-review` commands for interactive installation, non-interactive
  Claude Code user-scope installation, and release-pinned installation.
- Update the comments that currently describe a "single skill" installation
  so they describe installing both skills.
- Preserve the existing explanation that `kamae-review` depends on `kamae`.
- Update the detailed installation verification text to require both
  `kamae-ts:kamae` and `kamae-ts:kamae-review` after following either
  documented full-install path.
- Keep the English and Japanese guidance structurally equivalent.

## Verification

- Run `git diff --check`.
- Confirm all five public surfaces contain concrete install commands for both
  skills.
- Confirm the landing page has the paired interactive commands.
- Confirm the detailed installation pages and READMEs have matching paired
  interactive, non-interactive, and release-pinned examples in English and
  Japanese.
- Confirm the detailed verification instructions name both installed skills.

No skill implementation or evaluation suite changes are required because this
is a documentation-only correction.
