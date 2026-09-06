import { importOrders } from "./batch";
import { getOrder, submitOrder } from "./single";
import type { IntakeContext, Repository } from "./types";

export function createOrderIntake(dependencies: { repository: Repository }) {
  const { repository } = dependencies;
  return {
    submitOrder: (value: unknown, context: IntakeContext) =>
      submitOrder(repository, value, context),
    importOrders: (value: unknown, context: IntakeContext) =>
      importOrders(repository, value, context),
    getOrder: (id: unknown) => getOrder(repository, id),
  };
}

export type {
  BatchResponse,
  GetResponse,
  IntakeContext,
  Repository,
  StoredOrder,
  SubmitResponse,
} from "./types";

