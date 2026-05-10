/**
 * A practical example of PII protection using the Sensitive type wrapper
 *
 * Encloses values in a closure and automatically masks them in
 * JSON.stringify / console.log / template literals. Integrates with ArkType to auto-wrap at validation time.
 */

import { type } from "arktype";

// --- Sensitive Type ---

type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
    [Symbol.for("nodejs.util.inspect.custom")]: () => "[REDACTED]",
  }),
} as const;

// --- ArkType Integration ---

const sensitiveString = type("string").pipe(Sensitive.of);

const PatientSchema = type({
  id: "string.uuid",
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: "string",
});

type Patient = typeof PatientSchema.infer;

// --- Usage ---

const rawData = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "John Doe",
  email: "john@example.com",
  diagnosis: "Hypertension",
  role: "outpatient",
};

const result = PatientSchema(rawData);
if (result instanceof type.errors) {
  throw new Error(`Validation failed: ${result.summary}`);
}

const patient: Patient = result;

// Safe: PII is masked
// {"id":"550e8400-...","name":"[REDACTED]","email":"[REDACTED]","diagnosis":"[REDACTED]","role":"outpatient"}
console.log(JSON.stringify(patient));

// Access actual value only when explicitly needed
const actualEmail: string = patient.email.unwrap();
