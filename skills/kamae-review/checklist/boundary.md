# Boundary Defense Checklist

Reference: [`../../kamae/SKILL.md` §4](../../kamae/SKILL.md), [`../../kamae/boundary-defense.md`](../../kamae/boundary-defense.md), and the project's validation library guide under [`../../kamae/validation-libraries/`](../../kamae/validation-libraries/).

## 4.1 Is schema validation present at every external boundary? — High

Flag: API handlers, DB-result mappers, queue/message handlers, file/config loaders, or env-var readers that treat raw data as domain types without parsing it through a validation library schema (Zod / Valibot / ArkType).

## 4.2 Are `as` type assertions used? — High

Flag every `as` and verify it falls into one of these acceptable cases:
- External data: must be replaced by a validation schema parse.
- `as` inside a Branded Type factory: acceptable when no validation library is used (`unique symbol` pattern).
- Internal data: type inference should resolve it; if not, the type design is likely wrong.
