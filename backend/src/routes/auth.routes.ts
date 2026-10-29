import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserModel, FacilityModel } from "../models";
import { generateToken, authenticateToken, Role } from "../middleware/auth";
import { logAudit } from "../services/audit";

import rateLimit from "express-rate-limit";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts, please try again in 15 minutes." },
});

const roleEnum = z.enum(["ADMIN", "DEALER", "DRIVER", "FACTORY", "WORKER", "CUSTOMER"]);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  portalRole: roleEnum.optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: roleEnum.default("CUSTOMER"),
  phone: z.string().optional(),
  organization: z.string().optional(),
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: "Invalid input fields", details: parse.error.format() });
      return;
    }

    const { email, password, portalRole } = parse.data;

    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ success: false, error: "Invalid email or password." });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ success: false, error: "Invalid email or password." });
      return;
    }

    // Role-specific portal validation
    if (portalRole && user.role !== portalRole) {
      res.status(403).json({
        success: false,
        error: `Portal access denied. Your account role is '${user.role}', but you attempted to login to the '${portalRole}' portal. Please navigate to your authorized portal.`,
      });
      return;
    }

    if (
      user.status === "SUSPENDED" ||
      user.status === "INACTIVE" ||
      user.status === "ARCHIVED" ||
      user.isArchived
    ) {
      res.status(403).json({ success: false, error: "Account has been deactivated, suspended, or archived by administration." });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const facility = user.facilityId ? await FacilityModel.findById(user.facilityId) : null;

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      facilityId: user.facilityId,
    });

    await logAudit({
      userId: user._id.toString(),
      action: "USER_LOGIN",
      entityType: "USER",
      entityId: user._id.toString(),
      details: { role: user.role, portalRole },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organization: user.organization,
        employeeId: user.employeeId,
        facility: facility ? { id: facility._id.toString(), name: facility.name, code: facility.code } : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: "Invalid input fields", details: parse.error.format() });
      return;
    }

    const { email, password, fullName, role, phone, organization } = parse.data;

    // Security Gate: Non-admin users cannot create Admin accounts
    if (role === Role.ADMIN) {
      res.status(403).json({
        success: false,
        error: "Forbidden: Administrator accounts cannot be created via public registration. Contact system administration.",
      });
      return;
    }

    const existing = await UserModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ success: false, error: "An account with this email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role,
      phone,
      organization,
      status: "APPROVED",
    });

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });

    await logAudit({
      userId: user._id.toString(),
      action: "USER_REGISTERED",
      entityType: "USER",
      entityId: user._id.toString(),
      details: { role: user.role },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organization: user.organization,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await UserModel.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const facility = user.facilityId ? await FacilityModel.findById(user.facilityId) : null;

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organization: user.organization,
        employeeId: user.employeeId,
        facility: facility ? { id: facility._id.toString(), name: facility.name, code: facility.code } : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/auth/profile (Update permitted self details with role escalation block)
router.patch("/profile", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // Security check: Prevent privilege escalation
    if (req.body.role !== undefined || req.body.status !== undefined) {
      res.status(403).json({
        success: false,
        error: "Forbidden: Modifying account role or status is restricted to authorized Administrators.",
      });
      return;
    }

    const { fullName, phone, organization } = req.body;
    const update: any = {};
    if (fullName && typeof fullName === "string" && fullName.trim().length >= 2) {
      update.fullName = fullName.trim();
    }
    if (phone !== undefined) update.phone = String(phone).trim();
    if (organization !== undefined) update.organization = String(organization).trim();

    const updated = await UserModel.findByIdAndUpdate(req.user!.id, update, {
      new: true,
      select: "-passwordHash",
    });

    if (!updated) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    await logAudit({
      userId: req.user!.id,
      action: "USER_SELF_PROFILE_UPDATED",
      entityType: "USER",
      entityId: req.user!.id,
      details: { updatedFields: Object.keys(update) },
      ipAddress: req.ip,
    });

    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
