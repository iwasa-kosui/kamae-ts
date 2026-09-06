export interface IntakeContext {
  receivedOn: string;
}

export interface OrderInput {
  id: string;
  customerId: string;
  amountCents: number;
  shipOn: string;
}

export interface StoredOrder extends OrderInput {
  currency: "USD";
  receivedOn: string;
}

export interface Repository {
  get(id: string): Promise<StoredOrder | undefined>;
  save(id: string, order: StoredOrder): Promise<void>;
}

export interface ErrorResponse {
  status: 400 | 404 | 409 | 500;
  body: {
    code:
      | "invalid_order"
      | "invalid_batch"
      | "duplicate_order"
      | "order_not_found"
      | "storage_unavailable";
  };
}

export interface AcceptedResponse {
  status: 201;
  body: StoredOrder;
}

export type SubmitResponse = AcceptedResponse | ErrorResponse;
export type GetResponse =
  | { status: 200; body: StoredOrder }
  | ErrorResponse;
export type BatchRow = { index: number } & SubmitResponse;
export type BatchResponse =
  | {
      status: 200;
      body: {
        rows: BatchRow[];
        acceptedCount: number;
        totalAcceptedCents: number;
        latestShipOn: string | null;
      };
    }
  | ErrorResponse;

