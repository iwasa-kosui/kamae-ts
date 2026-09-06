export type Stock = {
  sku: string;
  totalUnits: number;
  reservedUnits: number;
  revision: number;
};

export type Reservation = {
  reservationId: string;
  sku: string;
  quantity: number;
};

export type ReservationEvent = {
  eventId: string;
  type: "reservation.created";
  reservationId: string;
  sku: string;
  quantity: number;
};

export type ReservationCommit = {
  expectedRevision: number;
  nextStock: Stock;
  reservation: Reservation;
  events: ReservationEvent[];
};

export type LegacyStorage = {
  getStock(sku: string): Promise<unknown>;
  getReservation(reservationId: string): Promise<unknown>;
  commitReservation(change: ReservationCommit): Promise<unknown>;
};

export type ServiceResponse = {
  status: 200 | 201 | 400 | 404 | 409 | 500;
  body: Record<string, unknown>;
};

export type Service = {
  handle(command: unknown): Promise<ServiceResponse>;
};
