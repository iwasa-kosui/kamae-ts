import { createHostExpenseLogger, type HostLogger } from "./infrastructure/host-logger";
import {
  createHostPaymentCharger,
  type HostPayment,
} from "./infrastructure/host-payment";
import {
  createHostExpenseResolver,
  createHostExpenseStore,
  type HostRepository,
} from "./infrastructure/host-repository";
import {
  createExpenseServiceAdapter,
  type ExpenseService,
} from "./service/expense-service";

export type CreateExpenseServiceDependencies = Readonly<{
  repository: HostRepository;
  payment: HostPayment;
  logger: HostLogger;
}>;

export const createExpenseService = (
  dependencies: CreateExpenseServiceDependencies,
): ExpenseService => {
  const resolver = createHostExpenseResolver(dependencies.repository);
  const store = createHostExpenseStore(dependencies.repository);
  const payment = createHostPaymentCharger(dependencies.payment);
  const logger = createHostExpenseLogger(dependencies.logger);

  return createExpenseServiceAdapter({
    resolver,
    store,
    payment,
    logger,
  });
};

