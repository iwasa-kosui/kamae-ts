# Boundary Defense Checklist

Reference: [`../../kamae/SKILL.md` §4](../../kamae/SKILL.md), [`../../kamae/boundary-defense.md`](../../kamae/boundary-defense.md), and the project's validation library guide under [`../../kamae/validation-libraries/`](../../kamae/validation-libraries/).

## 4.1 Is schema validation present at every external boundary? — High

Flag: API handlers, DB-result mappers, queue/message handlers, file/config loaders, or env-var readers that treat raw data as domain types without parsing it through a validation library schema (Zod / Valibot / ArkType).

## 4.2 Are `as` type assertions used? — High

The only permitted `as` forms are `as const` and `as const satisfies Type`. Flag every other `as` and verify it falls into one of these acceptable cases:
- External or unknown-typed data: must be replaced by a validation-library schema parse. `as` does not give the guarantee its type claims.
- `as` inside a Branded Type factory: tolerated only as a last-resort fallback when no validation library is present (`unique symbol` pattern). When flagged, recommend introducing a validation library and rewriting the brand with `z.brand()` / `v.brand()` / `.brand()` so the `as` can be removed.
- Internal data: type inference should resolve it; if not, the type design is likely wrong.
