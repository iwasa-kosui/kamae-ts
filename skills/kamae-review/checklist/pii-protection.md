# PII Protection Checklist

Reference: [`../../kamae/SKILL.md` §4 "PII Protection"](../../kamae/SKILL.md), [`../../kamae/boundary-defense.md`](../../kamae/boundary-defense.md).

## 4.3 Do PII fields use `Sensitive<T>`? — High

Flag: fields plausibly carrying personal information (name, email, phone, address, government IDs, payment details, health/diagnostic information, IP addresses) that are bare `string`/`number` rather than `Sensitive<T>`. Pay special attention to objects that may appear in logs or error messages. Verify that the validation schema auto-wraps such fields with `Sensitive.of`.

This check is independently toggleable via a `check-toggle` rule (`check: pii-protection`) for projects that handle no personal information.
