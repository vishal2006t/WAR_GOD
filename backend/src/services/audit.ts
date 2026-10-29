import { AuditLogModel } from "../models";

export async function logAudit(params: {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: any;
  ipAddress?: string;
}) {
  try {
    return await AuditLogModel.create({
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      detailsJson: params.details ? JSON.stringify(params.details) : null,
      ipAddress: params.ipAddress || "127.0.0.1",
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
