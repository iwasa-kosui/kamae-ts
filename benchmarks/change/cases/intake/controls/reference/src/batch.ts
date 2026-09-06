import { saveOrder } from "./orders";
import { parseOrder } from "./validation";
import type {
  BatchResponse,
  BatchRow,
  IntakeContext,
  Repository,
  SubmitResponse,
} from "./types";

export async function importOrders(
  repository: Repository,
  value: unknown,
  context: IntakeContext,
): Promise<BatchResponse> {
  if (!Array.isArray(value) || value.length > 100) {
    return { status: 400, body: { code: "invalid_batch" } };
  }

  const rows: BatchRow[] = [];
  let acceptedCount = 0;
  let totalAcceptedCents = 0;
  let latestShipOn: string | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const input = parseOrder(value[index], context.receivedOn);
    const result: SubmitResponse =
      input === undefined
        ? { status: 400, body: { code: "invalid_order" } }
        : await saveOrder(repository, input, context);
    rows.push({ index, ...result });

    if (result.status === 201) {
      const order = result.body;
      acceptedCount += 1;
      totalAcceptedCents += order.amountCents;
      if (latestShipOn === null || order.shipOn > latestShipOn) {
        latestShipOn = order.shipOn;
      }
    }
  }

  return {
    status: 200,
    body: { rows, acceptedCount, totalAcceptedCents, latestShipOn },
  };
}

