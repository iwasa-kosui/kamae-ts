import { z } from "zod";

export const CustomerIdBrand = Symbol();
export const CustomerIdSchema = z.string().uuid().brand<typeof CustomerIdBrand>();
export type CustomerId = z.infer<typeof CustomerIdSchema>;

export const TaxiRequestIdBrand = Symbol();
export const TaxiRequestIdSchema = z.string().uuid().brand<typeof TaxiRequestIdBrand>();
export type TaxiRequestId = z.infer<typeof TaxiRequestIdSchema>;
