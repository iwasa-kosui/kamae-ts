import { saveOrder } from "./orders";
import { isOrderId, parseOrder } from "./validation";
import type {
  GetResponse,
  IntakeContext,
  Repository,
  SubmitResponse,
} from "./types";

export async function submitOrder(
  repository: Repository,
  value: unknown,
  context: IntakeContext,
): Promise<SubmitResponse> {
  const input = parseOrder(value, context.receivedOn);
  if (input === undefined) {
    return { status: 400, body: { code: "invalid_order" } };
  }
  return saveOrder(repository, input, context);
}

export async function getOrder(
  repository: Repository,
  id: unknown,
): Promise<GetResponse> {
  if (!isOrderId(id)) {
    return { status: 400, body: { code: "invalid_order" } };
  }
  try {
    const order = await repository.get(id);
    return order === undefined
      ? { status: 404, body: { code: "order_not_found" } }
      : { status: 200, body: order };
  } catch {
    return { status: 500, body: { code: "storage_unavailable" } };
  }
}

