import type {
  IntakeContext,
  OrderInput,
  Repository,
  StoredOrder,
  SubmitResponse,
} from "./types";

export async function saveOrder(
  repository: Repository,
  input: OrderInput,
  context: IntakeContext,
): Promise<SubmitResponse> {
  try {
    const existing = await repository.get(input.id);
    if (existing !== undefined) {
      return { status: 409, body: { code: "duplicate_order" } };
    }
    const order: StoredOrder = {
      id: input.id,
      customerId: input.customerId,
      amountCents: input.amountCents,
      currency: "USD",
      shipOn: input.shipOn,
      receivedOn: context.receivedOn,
    };
    await repository.save(order.id, order);
    return { status: 201, body: order };
  } catch {
    return { status: 500, body: { code: "storage_unavailable" } };
  }
}

