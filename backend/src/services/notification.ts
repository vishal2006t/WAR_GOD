import { NotificationModel, UserModel } from "../models";

export interface SendNotificationParams {
  userId?: string;
  role?: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ALERT";
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

export async function sendNotification(params: SendNotificationParams): Promise<void> {
  try {
    const { userId, role, title, message, type = "INFO", entityType, entityId, actionUrl } = params;

    // Direct user notification
    if (userId) {
      await NotificationModel.create({
        userId,
        role,
        title,
        message,
        type,
        entityType,
        entityId,
        actionUrl,
        read: false,
      });
    }

    // Role-wide broadcast (e.g. all ADMINs or all FACTORY users)
    if (role && !userId) {
      const users = await UserModel.find({ role, status: "APPROVED" }).select("_id").lean();
      for (const u of users as any[]) {
        await NotificationModel.create({
          userId: u._id.toString(),
          role,
          title,
          message,
          type,
          entityType,
          entityId,
          actionUrl,
          read: false,
        });
      }
    }
  } catch (err: any) {
    console.warn("[Notification Service Notice] Failed to save notification:", err.message);
  }
}
