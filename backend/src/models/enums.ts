export const Role = {
  ADMIN: "ADMIN",
  DEALER: "DEALER",
  DRIVER: "DRIVER",
  FACTORY: "FACTORY",
  WORKER: "WORKER",
  CUSTOMER: "CUSTOMER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const BatchStatus = {
  REGISTERED: "REGISTERED",
  DISPATCHED: "DISPATCHED",
  RECEIVED: "RECEIVED",
  PROCESSED: "PROCESSED",
  DISPUTED: "DISPUTED",
} as const;
export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus];

export const DispatchStatus = {
  REGISTERED: "REGISTERED",
  ASSIGNED: "ASSIGNED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EN_ROUTE: "EN_ROUTE",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  ON_BREAK: "ON_BREAK",
  ARRIVED_AT_FACTORY: "ARRIVED_AT_FACTORY",
  DELIVERED: "DELIVERED",
  RECEIVED: "RECEIVED",
  DISPUTED: "DISPUTED",
  EXCEPTION: "EXCEPTION",
} as const;
export type DispatchStatus = (typeof DispatchStatus)[keyof typeof DispatchStatus];

export const AccountStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  SUSPENDED: "SUSPENDED",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];
