# Independent static audit: intake change case

## Outcome and method

The starter is consistent with the documented version 1 contract. The reference is consistent with all six preserved obligations and all seven new obligations. The broken control has one confirmed root cause: its batch summary converts canonical cents to major units. No additional implementation defect was found within the specified JSON-input and host contracts.

This is a source audit, not execution evidence. No application code, tests, type checker, package installation, model, network request or Git operation was run. The production-source trees were read in full and compared with a read-only directory diff. The private control description was checked against the code rather than treated as proof of correctness. No final score is assigned.

Paths below are relative to `benchmarks/change/cases/intake/`. Read material: `case.json`, `CHANGE.md`, `starter/API.md`, `starter/package.json`, `starter/tsconfig.json`; all six files (`index.ts`, `types.ts`, `validation.ts`, `orders.ts`, `single.ts`, `batch.ts`) in each of `starter/src/`, `controls/reference/src/` and `controls/broken/src/`; both controls' `IMPLEMENTATION.md`; and `controls/control.json`.

## Preserved obligations and starter health

| Obligation | Source evidence and assessment |
| --- | --- |
| B1: version 1 admission | `starter/src/validation.ts:4–41` checks the complete ID match, exact canonical date spelling, Gregorian date validity, optional literal numeric version 1, and bounded integer cents. `parseOrder` at lines 48–56 returns only validated recognized fields. Unknown object fields do not become substitutes for required fields. The same version 1 schema remains in `controls/reference/src/validation.ts:36–42`. |
| B2: stable canonical records | `starter/src/orders.ts:15–28` checks existing storage, constructs exactly the six specified fields, and saves only after absence is established. `starter/src/single.ts:29–35` returns intact records without writing. These files retain the same storage behavior in the reference. There is no instance-local record cache or migration step. |
| B3: stable API and responses | `starter/src/index.ts:5–14` and the reference counterpart expose the same three operations through the same factory. `single.ts:15–35`, `orders.ts:15–30` and `batch.ts:16–17,43–45` implement the documented status/code pairs and success statuses. |
| B4: validation before storage and persistent duplicate checks | `starter/src/single.ts:15–19` validates before `saveOrder`. `starter/src/batch.ts:26–30` does so per row. `starter/src/orders.ts:15–17` consults the shared repository and exits on a duplicate before any save. The reference uses the new normalization entry point in the same positions. There is no check against only the current batch or service instance. |
| B5: bounded batch and success-only summary | `starter/src/batch.ts:16–17` rejects the outer value before repository access. Lines 20–30 initialize the empty summary and process rows sequentially; lines 31–39 preserve row order and update summaries only for status 201, with canonical cents and strings. Reference behavior is the same. The broken control fails this obligation as detailed below. |
| B6: dependency failures and context | `starter/src/orders.ts:14–30` contains both repository rejections and does not return success until save resolves. `starter/src/single.ts:29–35` contains retrieval rejection. `starter/src/batch.ts:25–40` continues after a returned row error. Failed saves do not create any service-local reservation. `orders.ts:25` records the supplied `receivedOn` directly. The reference preserves these paths. |

The starter correctly rejects version 2; accepting it is the requested change, not a baseline obligation. There is no requirement for all batch elements to be validated before any row is saved: outer validation precedes all effects, and complete row validation precedes that row's effects. Sequential partial success is expressly required by `starter/API.md:65–74`.

The failure reasoning depends on the actual host contract at `starter/API.md:13–18`: intact canonical stored JSON, no commit after a rejected save, no lost acknowledgement, sequential calls and rows, and an unchanged trusted context. Concurrency protection, rollback after an unknown commit, repairing damaged records, and validating the trusted context are not missing starter features.

## New obligations and reference coverage

| Obligation | Source evidence and assessment |
| --- | --- |
| C1: explicit version selection | `controls/reference/src/validation.ts:36–42,64–75` makes the accepted alternatives mutually exclusive by the `formatVersion` literals. Omission fits only version 1; present 2 fits only version 2. Lines 85–101 select the canonical projection from the successful alternative. A valid legacy `amountCents` cannot rescue an invalid version 2 amount. |
| C2: exact decimal normalization | `controls/reference/src/validation.ts:44–51` requires text with the specified full grammar, splits the integer and fractional parts, right-pads the latter to cents, and checks the resulting bounded integer. Accepted values are at most 1,000,000 cents; their integer operations are exactly representable. The implementation does not multiply a floating-point parse of the whole decimal string by 100. Oversized text is rejected by the final range check rather than clamped or rounded into the accepted range. |
| C3: currency omission | `controls/reference/src/validation.ts:68–70` requires the amount object and decimal, and gives only the literal USD field an omission default. Null and other present JSON values fail. |
| C4: real calendar parts | `controls/reference/src/validation.ts:12–27,53–62` requires integer components, checks the bounded Gregorian date, and constructs a padded string. It uses no date-overflow or time-zone conversion. Null, a string, and incomplete objects do not satisfy the object schema. |
| C5: omission-only date default | `controls/reference/src/validation.ts:72,89–95` makes the whole version 2 date optional and defaults only after a successful parse. Version 1 still requires its string at line 41. `single.ts:15` and `batch.ts:26` pass the supplied context date; the batch retains the same context object for every sequential row. No clock is consulted. |
| C6: both consumers and downstream values | `controls/reference/src/single.ts:15–19` and `batch.ts:26–38` consume the same normalized `OrderInput`. `orders.ts:19–28` stores and returns those normalized values. Batch summary accumulation uses the successfully saved record's integer cents and canonical string, not the wire amount or date. The broken control fails the cents portion of this obligation. |
| C7: canonical compatibility | `controls/reference/src/validation.ts:89–102` projects wire inputs into the old internal values, and `orders.ts:19–26` explicitly creates the old six-field record. `orders.ts:15–17` and `single.ts:29–33` use the same repository for old records and either new input version. No version marker, migration, or incidental rewrite appears. |

## Confirmed finding: broken batch total has the wrong unit

**INT-1 — Medium severity; B5 and C6; high confidence.** The broken control divides each successfully saved canonical cent amount by 100 before adding it to `totalAcceptedCents`.

- Evidence: `controls/broken/src/batch.ts:33–38`, specifically line 36: `totalAcceptedCents += order.amountCents / 100`. The reference at the same line adds `order.amountCents` directly.
- Call path: `createOrderIntake(...).importOrders` → `importOrders` → `parseOrder` → successful `saveOrder` → summary accumulation.
- Permitted counterexample: an initially empty successful repository, context `{ "receivedOn": "2028-02-29" }`, and a one-row batch `[ { "formatVersion": 2, "id": "ORDER_1", "customerId": "BUYER_1", "amount": { "decimal": "1.15" } } ]`.
- Actual behavior derived from source: status 200; a status-201 row with `amountCents: 115`, `shipOn: "2028-02-29"`, currency USD and the supplied received date; the same canonical record is saved; `acceptedCount` is 1 and `latestShipOn` is the supplied date; `totalAcceptedCents` is 1.15.
- Required behavior: the same successful record, row and other summaries, with `totalAcceptedCents: 115`, as required by `starter/API.md:70–72` and `CHANGE.md:48–50`.
- Consequence: callers receive a money total in the wrong unit, and many batches violate the total's integer-cent contract. Version 1 batches also regress: a single accepted 1250-cent order yields 12.5 instead of 1250.
- Minimal correction: remove division by 100 from the accumulator.
- Regression obligations: retain exact cent totals for each version and mixed batches; exclude invalid, duplicate and failed-save rows; preserve saved/row values and the accepted count/date summaries.

The production-source directory diff contains only this one changed expression. Its effects on B5, C6, legacy totals, and fractional summary values are manifestations of one root cause and should not be counted as independent defects. Validation, persistence, single intake, retrieval, accepted counts, latest dates, and row failure isolation are unchanged from the reference. This agrees with the private description at `controls/control.json:15–63`; no additional root cause was identified.

## Adversarial static traces and false-positive checks

These are source-derived obligations and traces, not executed tests:

1. **Wrong-version rescue:** submit valid IDs, `formatVersion: 2`, a valid legacy `amountCents` and legacy date, but omit `amount`. Version 2 fails its required amount, and version 1 fails its literal version; the result is 400 before get/save. A present version string such as `"2"` likewise matches neither alternative.
2. **Invalid input with an existing ID:** use a duplicate ID with `amount.decimal: "1.005"`, currency null, or the date `{ "year": 2028, "month": 2, "day": 30 }`. Complete parsing fails before any repository access, so the result remains 400 even if lookup would return an old record or reject. Valid duplicates instead reach lookup and return 409 without saving.
3. **Omission versus invalid presence:** a version 2 order with decimal `"0.01"` and no date receives the trusted context date. Present null fails. The same omitted date on version 1 fails. Defaults cannot turn these invalid inputs into accepted rows.
4. **Decimal boundaries and exactness:** `"1.15"` computes `1 * 100 + 15`; `"10000.00"` reaches exactly 1,000,000; `"10000.01"` exceeds the bound. `"01.20"`, `"1."`, `"1e2"`, `"+1"`, numeric 1.2 and trailing-newline text fail the full grammar. `matchesEntire` also prevents the regular-expression end anchor from accepting an ID or date with a trailing newline.
5. **Failure followed by reuse:** with two otherwise valid rows sharing an ID, let the first get resolve absent and its save reject without commit, then let the second get resolve absent and save succeed. The rows are 500 then 201, and only the second contributes to summaries. There is no instance-local claim left by the first attempt. If the first save succeeds instead, the second lookup sees a duplicate and the second row contributes nothing.
6. **Published mixed example:** the five rows at `CHANGE.md:58–68` reach 201, 201, 400, 409 and 201. Reference accumulation is 1250 + 115 + 1 = 1366 and its latest canonical date is `2028-03-02`. The broken accumulator instead adds each accepted amount divided by 100; the row outcomes remain the same.
7. **JSON and host boundaries:** explicit JavaScript `undefined` properties, getters that throw, arbitrary mutated stored objects, and changing context values are outside `starter/API.md:7,13–18`. Treating optional/default schema behavior on these inputs as an in-scope defect would expand the task. No free-text privacy or unrelated inventory feature is present.

## Specification and grading neutrality

No blocking ambiguity, style requirement, or version-favoring directive was found. The requirements specify observable admission, normalized values, stored compatibility, effect ordering, and failure responses. `CHANGE.md:72–74` and `starter/API.md:78` explicitly leave internal organization and design open and state the scope exclusions. The existing Zod dependency is part of the supplied working service, not a requirement to use a particular new schema operation.

Two phrases should be read behaviorally during grading; they do not justify deductions against the supplied reference:

- `CHANGE.md:8` says canonical fields remain stable "using the existing types." In context, this means the canonical field value types in `starter/API.md:35–43`, not mandatory preservation of interface names, aliases, file locations, or every internal declaration. `CHANGE.md:72` explicitly makes internal types a choice. A small wording improvement would be "with the documented canonical field value types."
- `case.json:31` says "Validate only the selected version," and `CHANGE.md:22` prohibits fallback after failure. This constrains acceptance and interpretation, not the number of pure parser alternatives an implementation evaluates. The reference's literal-constrained union cannot successfully reinterpret a failed version 2 input as version 1. An explicit switch, such a mutually exclusive union, or another equivalent parser must receive the same behavioral assessment. A small clarification could state that unrelated branch evaluation is allowed when it cannot affect accepted semantics or cause effects.

A complete manual parser, schema transforms, separate version decoders, different internal type names, or a single-file implementation can all satisfy the same obligations. Conversely, merely introducing version-specific interfaces or a preferred validation pattern does not establish correct batch totals, omission rules, or storage compatibility. Any maintenance assessment should name a real required edit or failure path rather than rewarding similarity to the reference.

The only implementation finding is the intentional broken-control unit error. Runtime/library integration and type-check results remain for the separately authorized validation stage.
