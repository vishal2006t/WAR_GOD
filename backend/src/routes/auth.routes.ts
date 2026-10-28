import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { generateToken, authenticateToken } from "../middleware/auth";
import { Role, AccountStatus } from "@prisma/client";
import { logAudit } from "../services/audit";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  portalRole: z.nativeEnum(Role).optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.nativeEnum(Role).default(Role.CUSTOMER),
  phone: z.string().optional(),
  organization: z.string().optional(),
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: "Invalid input fields", details: parse.error.format() });
      return;
    }

    const { email, password, portalRole } = parse.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { facility: true },
    });

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

    if (user.status === AccountStatus.SUSPENDED) {
      res.status(403).json({ success: false, error: "Account has been suspended by administration." });
      return;
    }

    const token = generateToken(user);

    await logAudit({
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "USER",
      entityId: user.id,
      details: { role: user.role, portalRole },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organization: user.organization,
        facility: user.facility,
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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, error: "An account with this email already exists." });
      return;
    }

    // High-privilege roles start as PENDING unless created by admin or customer
    const status = (role === Role.ADMIN || role === Role.FACTORY || role === Role.WORKER || role === Role.DRIVER)
      ? AccountStatus.APPROVED // For hackathon demo ease, approved
      : AccountStatus.APPROVED;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role,
        phone,
        organization,
        status,
      },
    });

    const token = generateToken(user);

    await logAudit({
      userId: user.id,
      action: "USER_REGISTERED",
      entityType: "USER",
      entityId: user.id,
      details: { role: user.role },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
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
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { facility: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organization: user.organization,
        facility: user.facility,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
