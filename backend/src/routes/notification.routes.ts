import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { NotificationModel } from "../models";

const router = Router();

// GET /api/notifications (List user notifications)
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const unreadOnly = req.query.unreadOnly === "true";
    const where: any = { userId: req.user!.id };
    if (unreadOnly) {
      where.read = false;
    }

    const notifications = await NotificationModel.find(where)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await NotificationModel.countDocuments({
      userId: req.user!.id,
      read: false,
    });

    const formatted = notifications.map((n: any) => ({
      ...n,
      id: n._id.toString(),
    }));

    res.json({ success: true, notifications: formatted, unreadCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", authenticateToken, async (req: Request, res: Response) => {
  try {
    const count = await NotificationModel.countDocuments({
      userId: req.user!.id,
      read: false,
    });
    res.json({ success: true, unreadCount: count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/notifications/:id/read (Mark single notification as read)
router.patch("/:id/read", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ success: false, error: "Notification not found" });
      return;
    }

    res.json({ success: true, notification });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/notifications/read-all (Mark all user notifications as read)
router.patch("/read-all", authenticateToken, async (req: Request, res: Response) => {
  try {
    await NotificationModel.updateMany({ userId: req.user!.id, read: false }, { read: true });
    res.json({ success: true, message: "All notifications marked as read." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
