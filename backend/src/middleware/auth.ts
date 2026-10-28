import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";
import { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "ecotrace-super-secure-hackathon-jwt-secret-2026";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  facilityId?: string | null;
  organization?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      facilityId: user.facilityId,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    res.status(401).json({ success: false, error: "Access denied. Authentication token required." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        facilityId: true,
        organization: true,
        status: true,
      },
    });

    if (!user || user.status === "SUSPENDED") {
      res.status(403).json({ success: false, error: "User account suspended or not found." });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ success: false, error: "Invalid or expired authentication token." });
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized. Please log in." });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden. Role '${req.user.role}' is not authorized for this resource. Required: ${allowedRoles.join(", ")}`,
      });
      return;
    }

    next();
  };
}
