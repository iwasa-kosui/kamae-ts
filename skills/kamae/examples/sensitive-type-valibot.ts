/**
 * A practical example of PII protection using the Sensitive type wrapper
 *
 * Encloses values in a closure and automatically masks them in
 * JSON.stringify / console.log / template literals. Integrates with Valibot to auto-wrap at parse time.
 */

import * as v from "valibot";

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

// --- Valibot Integration ---

const sensitiveString = v.pipe(v.string(), v.transform(Sensitive.of));

const PatientSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: v.string(),
});

type Patient = v.InferOutput<typeof PatientSchema>;

// --- Usage ---

const rawData = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "John Doe",
  email: "john@example.com",
  diagnosis: "Hypertension",
  role: "outpatient",
};

const patient: Patient = v.parse(PatientSchema, rawData);

// Safe: PII is masked
// {"id":"550e8400-...","name":"[REDACTED]","email":"[REDACTED]","diagnosis":"[REDACTED]","role":"outpatient"}
console.log(JSON.stringify(patient));

// Access actual value only when explicitly needed
const actualEmail: string = patient.email.unwrap();
