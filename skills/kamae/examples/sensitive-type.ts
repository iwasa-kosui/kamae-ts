/**
 * A practical example of PII protection using the Sensitive type wrapper
 *
 * Encloses values in a closure and automatically masks them in
 * JSON.stringify / console.log / template literals. Integrates with Zod to auto-wrap at parse time.
 */

import { z } from "zod";

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

// --- Zod Integration ---

const sensitiveString = z.string().transform(Sensitive.of);

const PatientSchema = z.object({
  id: z.string().uuid(),
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: z.string(),
});

type Patient = z.infer<typeof PatientSchema>;

// --- Usage ---

const rawData = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "John Doe",
  email: "john@example.com",
  diagnosis: "Hypertension",
  role: "outpatient",
};

const patient: Patient = PatientSchema.parse(rawData);

// Safe: PII is masked
// {"id":"550e8400-...","name":"[REDACTED]","email":"[REDACTED]","diagnosis":"[REDACTED]","role":"outpatient"}
console.log(JSON.stringify(patient));

// Access actual value only when explicitly needed
const actualEmail: string = patient.email.unwrap();
