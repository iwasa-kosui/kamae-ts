# Error Boundary Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update kamae-ts so that expected, decision-bearing failures use `Result`, while unexpected faults and contract violations propagate as exceptions; permit contained private control-flow exceptions.

**Architecture:** Make `skills/kamae/error-handling.md` the canonical four-category policy, then apply it consistently to the generator skill, result-library examples, state-modeling example, and review checklist. Encode the behavior in task-scoped eval graders, replacing the current suite-wide prohibition on thrown exceptions. Public English and Japanese documentation mirrors the canonical rules without mandating a framework-specific global error handler.

**Tech Stack:** Markdown skills, YAML eval suites, Bun/TypeScript Codex eval runner, TypeScript fixtures, neverthrow, byethrow, fp-ts, OptionT.

**Spec:** `docs/superpowers/specs/2026-08-16-error-boundary-policy-design.md`

## Global Constraints

- Expected business and validation failures remain use-case-specific discriminated-union members in `Result`.
- An external failure belongs in `Result` only when the workflow has an explicit recovery, fallback, retry, or deferral decision.
- Unexpected infrastructure faults and assertion/invariant failures propagate as thrown errors or rejected promises; they must not be converted to a catch-all domain error.
- Local control-flow sentinels are private, caught by an explicit associated boundary, distinguished from other errors, and all non-sentinels are rethrown unchanged.
- Keep English and Japanese public documentation semantically equivalent.
- Do not add a logging, web framework, or global error-handler dependency.
- Preserve the existing Result library choices; do not change the eval runner.

---

### Task 1: Encode the new generator-skill behavior in the kamae eval suite

**Files:**
- Modify: `evals/kamae/eval.yaml:24-41`
- Delete: `evals/kamae/tasks/error-handling-no-throw.yaml`
- Create: `evals/kamae/tasks/error-handling-expected-domain-errors.yaml`
- Create: `evals/kamae/tasks/local-control-flow-exception.yaml`

**Interfaces:**
- Consumes: the four-category policy in the spec.
- Produces: generation tasks that permit valid `throw` expressions only where the task explicitly requests a local sentinel, and that reject a catch-all `RepositoryError` as a business error.

- [ ] **Step 1: Replace the suite-wide throw ban with task-scoped expectations**

  In `evals/kamae/eval.yaml`, remove only the `no_thrown_exceptions` text grader. Keep `no_class_domain_models`, `lazy_loading`, and `tasks: ["tasks/*.yaml"]` unchanged:

  ```yaml
  graders:
    - type: text
      name: no_class_domain_models
      config:
        regex_not_match:
          - "(?m)^\\s*class\\s+\\w+"
    - type: behavior
      name: lazy_loading
      config:
        max_tool_calls: 15
  ```

- [ ] **Step 2: Turn the existing no-throw task into an expected-domain-error task**

  Create `error-handling-expected-domain-errors.yaml` from the old task, preserving its task id. Change its `name`, `description`, and `inputs.prompt` to require `RequestNotFound`, `InvalidState`, and `DriverNotAvailable` in a use-case-specific error DU. Require `Result` for those three outcomes, and state that an unclassified DB timeout, configuration defect, or unknown SDK failure must not be put into a `RepositoryError` member.

  Add task-scoped graders that require an explicit business error and reject the generic repository error:

  ```yaml
  graders:
    - type: text
      name: expected_business_errors_are_results
      config:
        regex_match:
          - "(?i)Result"
          - "RequestNotFound|InvalidState|DriverNotAvailable"
        regex_not_match:
          - "RepositoryError"
          - "throw\\s+new\\s+\\w*Error\\b"
  ```

- [ ] **Step 3: Add a positive local-control-flow task**

  Create `evals/kamae/tasks/local-control-flow-exception.yaml`. Its prompt must ask for a synchronous tree or list search that exits early by throwing a private sentinel from a nested helper, catches that sentinel at an explicitly named search boundary, returns `Option<Driver>` or an equivalent public value, and rethrows unknown errors. It must say that the sentinel is not a business error and must not appear in the public return type.

  Add graders that require a `try`/`catch`, a `throw`, and a rethrow:

  ```yaml
  graders:
    - type: text
      name: contained_local_control_flow
      config:
        regex_match:
          - "\\btry\\b"
          - "\\bcatch\\b"
          - "\\bthrow\\b"
          - "throw\\s+error"
  ```

- [ ] **Step 4: Validate the changed suite schema before changing the skill prose**

  Run:

  ```bash
  cd /Users/kosui/ghq/github.com/iwasa-kosui/kamae-ts/.wt/codex/research-dmmf-kamae-ts
  bun run evals/runner/run.ts evals/kamae/eval.yaml --dry-run
  ```

  Expected: the suite parses, all task files resolve, and every task-scoped regex compiles.

- [ ] **Step 5: Commit the behavioral eval contract**

  ```bash
  git add evals/kamae/eval.yaml evals/kamae/tasks
  git commit -m "test(kamae): define error boundary eval cases"
  ```

### Task 2: Define the four-category policy in the canonical kamae skill

**Files:**
- Modify: `skills/kamae/SKILL.md:59-62`
- Modify: `skills/kamae/error-handling.md:1-80`

**Interfaces:**
- Consumes: task-scoped generator expectations from Task 1.
- Produces: a canonical policy that downstream examples and kamae-review can cite.

- [ ] **Step 1: Add the policy before changing the detailed examples**

  Replace the blanket statement that domain code never throws in `skills/kamae/SKILL.md` with this concise contract:

  ```markdown
  - Model expected business failures as use-case-specific `Result` error unions.
  - Represent an external failure in `Result` only when the workflow has a documented recovery decision.
  - Let unexpected infrastructure failures and contract/invariant violations propagate as exceptions to the application error boundary.
  - A private control-flow sentinel is allowed when its associated boundary catches only that sentinel and rethrows all other errors.
  ```

- [ ] **Step 2: Rewrite `error-handling.md` around failure classification**

  Add a four-row table using the exact categories `Expected domain failure`, `Recoverable external failure`, `Unexpected infrastructure fault`, and `Contract or invariant violation`. For each row, state its deciding question, representation, and owner.

  Include this representative TypeScript split; adapt imports to the repository’s existing Result-library-neutral style:

  ```ts
  type AssignDriverError =
    | { readonly kind: "RequestNotFound"; readonly requestId: RequestId }
    | { readonly kind: "InvalidState"; readonly requestId: RequestId }
    | { readonly kind: "DriverNotAvailable"; readonly driverId: DriverId };

  type AssignDriver = (
    command: AssignDriverCommand,
  ) => Promise<Result<AssignedDriver, AssignDriverError>>;

  type RequestStore = {
    readonly save: (request: AssignedRequest) => Promise<void>;
  };
  ```

  Explain that `RequestStore.save` may reject for an unexpected fault, whereas a named `ExternalServiceError` belongs in `Result` only when the workflow specifies how to continue.

- [ ] **Step 3: Document assertion and local-control-flow exceptions separately**

  Keep `assertNever` as a contract violation. Add a private-sentinel example which identifies one sentinel and rethrows every other error:

  ```ts
  const foundDriver = Symbol("foundDriver");

  type FoundDriver = {
    readonly kind: typeof foundDriver;
    readonly driver: Driver;
  };

  const findFirstAvailable = (drivers: readonly Driver[]): Option<Driver> => {
    try {
      drivers.forEach((driver) => {
        if (driver.isAvailable) {
          throw { kind: foundDriver, driver } satisfies FoundDriver;
        }
      });
      return none;
    } catch (error: unknown) {
      if (isFoundDriver(error)) return some(error.driver);
      throw error;
    }
  };
  ```

  State explicitly that thrown validation errors, invalid state transitions, and other expected domain errors remain prohibited.

- [ ] **Step 4: Check generated-text policy consistency**

  Verify the local Markdown changes have no malformed fenced blocks:

  ```bash
  cd /Users/kosui/ghq/github.com/iwasa-kosui/kamae-ts/.wt/codex/research-dmmf-kamae-ts
  git diff --check
  rg -n "never throws|all failures|RepositoryError" skills/kamae/SKILL.md skills/kamae/error-handling.md
  ```

  Expected: no `never throws` or `all failures` policy remains; `RepositoryError` does not appear as the default error design.

- [ ] **Step 5: Commit the canonical policy**

  ```bash
  git add skills/kamae/SKILL.md skills/kamae/error-handling.md
  git commit -m "docs(kamae): classify expected and unexpected failures"
  ```

### Task 3: Align state-modeling and every Result-library example

**Files:**
- Modify: `skills/kamae/state-modeling.md:157-197`
- Modify: `skills/kamae/result-libraries/neverthrow.md:69-125`
- Modify: `skills/kamae/result-libraries/byethrow.md:100-174`
- Modify: `skills/kamae/result-libraries/fp-ts.md:88-157`
- Modify: `skills/kamae/result-libraries/option-t.md:92-145`

**Interfaces:**
- Consumes: the canonical `Result` boundary from Task 2.
- Produces: examples where the error generic contains only documented business or recoverable-external errors, while store/gateway faults propagate through `Promise` rejection.

- [ ] **Step 1: Replace the state-modeling repository contract**

  Change `RequestResolver` and `RequestStore` so they return `Promise<Request>` and `Promise<void>` for ordinary persistence. Remove the generic `RepositoryError` and remove it from the use-case error union. Keep business absence as `RequestNotFound` in the use-case logic rather than treating it as an infrastructure fault.

  Preserve the pure decision shape in the example:

  ```ts
  const assignDriver = (
    request: Request,
    driver: Driver,
    assignedAt: AssignedAt,
  ): Result<AssignedRequest, InvalidState | DriverNotAvailable> => {
    // existing pure state transition
  };
  ```

- [ ] **Step 2: Update the neverthrow recipe first**

  Remove `ResultAsync<Request, RepositoryError>` from the resolver/store types and remove `mapErr` branches that turn a rejected repository call into `RepositoryError`. Keep `ResultAsync` for chaining expected errors only. Make the orchestration example use `await` for `findById`/`save` and `match` or the library’s normal combinator for `assignDriver`’s expected `Result`.

  Add a short note: when the product defines a recovery for a named external failure, introduce a precise `ExternalServiceError` instead of a generic `cause: unknown` wrapper.

- [ ] **Step 3: Apply the identical semantic contract to the remaining three recipes**

  Make these type-level substitutions, preserving each library’s idiom:

  ```ts
  // byethrow / OptionT
  type RequestStore = { readonly save: (request: AssignedRequest) => Promise<void> };

  // fp-ts
  type RequestStore = { readonly save: (request: AssignedRequest) => Task<void> };
  ```

  The `Either`/`Result` error generic must remain `AssignDriverError`, with no catch-all `RepositoryError` member. Do not catch rejected persistence effects solely to map them into that union.

- [ ] **Step 4: Add a documented recoverable-external counterexample**

  In one shared explanatory section of each recipe, show the exceptional case where a business decision exists:

  ```ts
  type PaymentAuthorizationError = {
    readonly kind: "AuthorizationTemporarilyUnavailable";
    readonly retryAfter: RetryAfter;
  };
  ```

  Explain that this type appears in `Result` only because the workflow can defer or retry authorization; it is not a wrapper for arbitrary transport failures.

- [ ] **Step 5: Verify that no recipe retains the old default**

  Run:

  ```bash
  cd /Users/kosui/ghq/github.com/iwasa-kosui/kamae-ts/.wt/codex/research-dmmf-kamae-ts
  rg -n "RepositoryError|cause: unknown" skills/kamae/state-modeling.md skills/kamae/result-libraries
  ```

  Expected: no matches, unless an occurrence is in a paragraph explicitly labelling the pattern as prohibited.

- [ ] **Step 6: Commit aligned examples**

  ```bash
  git add skills/kamae/state-modeling.md skills/kamae/result-libraries
  git commit -m "docs(kamae): keep unexpected faults out of Result examples"
  ```

### Task 4: Make kamae-review distinguish violations from permitted exceptions

**Files:**
- Modify: `skills/kamae-review/checklist/error-handling.md:5-15`
- Delete: `evals/kamae-review/tasks/flag-throw-in-domain.yaml`
- Create: `evals/kamae-review/tasks/flag-thrown-business-error.yaml`
- Create: `evals/kamae-review/tasks/allow-contained-local-exception.yaml`
- Create: `evals/kamae-review/tasks/flag-unexpected-fault-as-domain-result.yaml`
- Create: `evals/kamae-review/fixtures/clean/contained-local-exception.ts`
- Create: `evals/kamae-review/fixtures/violations/unexpected-fault-as-domain-result.ts`

**Interfaces:**
- Consumes: the four-category policy from Task 2 and the final examples from Task 3.
- Produces: review guidance and fixtures that flag thrown business errors and catch-all technical `Result` errors, while accepting contract-failure propagation and contained control-flow sentinels.

- [ ] **Step 1: Replace the blanket checklist rule with the four classification questions**

  In `skills/kamae-review/checklist/error-handling.md`, retain a Medium finding for `throw` of a validation or business-state failure. Add a Medium finding for wrapping an unclassified fault in `RepositoryError`/`cause: unknown` and adding it to a domain union. Add explicit no-finding conditions for `assertNever`, a failed internal assertion, and an unexpected fault that is allowed to reach the application error boundary.

  Include this reviewer decision table:

  ```markdown
  | Observed failure | Review action |
  | --- | --- |
  | Expected validation or business-state failure is thrown | Medium: require a use-case-specific Result error |
  | External failure has a documented recovery but is thrown | Medium: model the named recoverable failure in Result |
  | Unknown outage, config defect, or assertion is wrapped as RepositoryError | Medium: allow propagation instead of a catch-all domain error |
  | Private sentinel is caught by its associated boundary and rethrows unknown errors | No finding |
  ```

- [ ] **Step 2: Narrow the current thrown-domain task to business failures**

  Create `flag-thrown-business-error.yaml` from the old task. Change its name and description to say that `InvalidState` and invalid input are expected failures that must be returned as `Result`; retain the separate boundary-cast finding. Add a task-scoped text grader requiring a Medium error-handling finding and `Result`:

  ```yaml
  graders:
    - type: text
      name: reports_thrown_business_error
      config:
        regex_match:
          - "(?i)(Medium|\[P2\])"
          - "(?i)(throw|exception)"
          - "(?i)Result"
  ```

- [ ] **Step 3: Add a clean local-control-flow fixture**

  Create `contained-local-exception.ts` with a non-exported `Symbol` sentinel, a nested helper that throws it on the first matching driver, and an exported `findFirstAvailable` boundary which catches only that sentinel. The guard must discriminate `unknown`; the catch must end with `throw error` for every other value. No business validation or state-transition error may use this mechanism.

  Create the task with a `regex_not_match` grader for a Medium finding about the sentinel or its `throw` expression:

  ```yaml
  graders:
    - type: text
      name: does_not_flag_contained_sentinel
      config:
        regex_not_match:
          - "(?is)(Medium|\[P2\]).{0,160}(sentinel|findFirstAvailable|throw)"
  ```

- [ ] **Step 4: Add an unexpected-fault-as-domain-result violation fixture**

  Create `unexpected-fault-as-domain-result.ts` where a repository catches an arbitrary rejected database call and returns:

  ```ts
  type RepositoryError = {
    readonly kind: "RepositoryError";
    readonly cause: unknown;
  };
  ```

  It must add that type to `AssignDriverError`. The corresponding review task must require a Medium finding explaining that only named, recoverable external failures belong in `Result` and that unknown infrastructure faults should propagate.

- [ ] **Step 5: Validate both review task schemas**

  Run:

  ```bash
  cd /Users/kosui/ghq/github.com/iwasa-kosui/kamae-ts/.wt/codex/research-dmmf-kamae-ts
  bun run evals/runner/run.ts evals/kamae-review/eval.yaml --dry-run
  ```

  Expected: all five review task definitions, fixtures, and task-scoped regexes validate.

- [ ] **Step 6: Commit review policy and eval coverage**

  ```bash
  git add skills/kamae-review/checklist/error-handling.md evals/kamae-review
  git commit -m "test(kamae-review): classify exception handling findings"
  ```

### Task 5: Synchronize public English and Japanese documentation

**Files:**
- Modify: `README.md:21-25`
- Modify: `README.ja.md:21-25`
- Modify: `docs/en/error-handling.md`
- Modify: `docs/ja/error-handling.md`
- Modify: `docs/en/code-review.md:105-119`
- Modify: `docs/ja/code-review.md:105-119`
- Modify: `docs/en/state-modeling.md`
- Modify: `docs/ja/state-modeling.md`
- Modify: `docs/en/result-libraries/neverthrow.md`
- Modify: `docs/en/result-libraries/byethrow.md`
- Modify: `docs/en/result-libraries/fp-ts.md`
- Modify: `docs/en/result-libraries/option-t.md`
- Modify: `docs/ja/result-libraries/neverthrow.md`
- Modify: `docs/ja/result-libraries/byethrow.md`
- Modify: `docs/ja/result-libraries/fp-ts.md`
- Modify: `docs/ja/result-libraries/option-t.md`

**Interfaces:**
- Consumes: the canonical source and examples from Tasks 2–4.
- Produces: user-facing docs with no obsolete no-throw guarantee or generic repository-error recipe.

- [ ] **Step 1: Update the README claims**

  Replace any claim equivalent to “domain code never throws” with a compact distinction between expected domain failures (`Result`) and unexpected faults (exception propagation). Keep the English and Japanese lists in the same order.

- [ ] **Step 2: Rewrite public error-handling and review pages from the canonical source**

  Add the four-category table, the decision test (“does a consumer have a specified domain decision?”), and the private-sentinel conditions. State in both languages that the application boundary owns logging and generic operational responses, without naming a framework.

- [ ] **Step 3: Synchronize state-modeling and library recipes**

  Apply the exact semantic changes from Task 3: expected error union only, ordinary repository `Promise`/effect rejection for unexpected faults, and a named recoverable-external example. Translate explanatory prose rather than translating code identifiers.

- [ ] **Step 4: Search for stale policy wording across all public docs**

  Run:

  ```bash
  cd /Users/kosui/ghq/github.com/iwasa-kosui/kamae-ts/.wt/codex/research-dmmf-kamae-ts
  rg -n "never throw|never throws|RepositoryError|cause: unknown|例外を投げない|例外を投げません" README.md README.ja.md docs/en docs/ja
  ```

  Expected: no stale normative claim; any remaining `RepositoryError` occurrence explicitly identifies the old design as prohibited.

- [ ] **Step 5: Commit synchronized public docs**

  ```bash
  git add README.md README.ja.md docs/en docs/ja
  git commit -m "docs: explain error boundaries and local exceptions"
  ```

### Task 6: Run end-to-end validation and review changed guidance

**Files:**
- Verify: `skills/kamae/**`
- Verify: `skills/kamae-review/**`
- Verify: `evals/kamae/**`
- Verify: `evals/kamae-review/**`
- Verify: `README.md`, `README.ja.md`, `docs/en/**`, `docs/ja/**`

**Interfaces:**
- Consumes: all commits from Tasks 1–5.
- Produces: validated skill prose and eval behavior ready for review.

- [ ] **Step 1: Run static validation for both suites**

  ```bash
  cd /Users/kosui/ghq/github.com/iwasa-kosui/kamae-ts/.wt/codex/research-dmmf-kamae-ts
  bun run evals/runner/run.ts evals/kamae/eval.yaml --dry-run
  bun run evals/runner/run.ts evals/kamae-review/eval.yaml --dry-run
  ```

  Expected: both commands exit successfully; all YAML, regexes, skills, and fixture paths resolve.

- [ ] **Step 2: Run the real-model kamae suite**

  ```bash
  cd /Users/kosui/ghq/github.com/iwasa-kosui/kamae-ts/.wt/codex/research-dmmf-kamae-ts
  bun run evals/runner/run.ts evals/kamae/eval.yaml --output /private/tmp/results-kamae-error-boundary.json
  ```

  Expected: aggregate score is at least `0.7`; the expected-error task avoids generic repository errors and the local-control-flow task permits a contained sentinel.

- [ ] **Step 3: Run the real-model kamae-review suite**

  ```bash
  cd /Users/kosui/ghq/github.com/iwasa-kosui/kamae-ts/.wt/codex/research-dmmf-kamae-ts
  bun run evals/runner/run.ts evals/kamae-review/eval.yaml --output /private/tmp/results-kamae-review-error-boundary.json
  ```

  Expected: aggregate score is at least `0.7`; reviewers flag the thrown business error and generic technical Result error but do not flag the clean sentinel fixture.

- [ ] **Step 4: Inspect eval output for policy-specific regressions**

  Run:

  ```bash
  rg -n '"score"|RepositoryError|contained|sentinel|unexpected' /private/tmp/results-kamae-error-boundary.json /private/tmp/results-kamae-review-error-boundary.json
  ```

  Expected: no task failure is caused by a global no-throw rule, and no review response calls the clean sentinel a Medium finding.

- [ ] **Step 5: Perform final documentation and diff checks**

  ```bash
  cd /Users/kosui/ghq/github.com/iwasa-kosui/kamae-ts/.wt/codex/research-dmmf-kamae-ts
  git diff main...HEAD --check
  git status --short
  ```

  Expected: no whitespace errors; the worktree is clean after all task commits.
