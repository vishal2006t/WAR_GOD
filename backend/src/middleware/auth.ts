import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserModel, Role } from "../models";
export { Role };

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

export function generateToken(user: { id: string; email: string; fullName: string; role: string; facilityId?: string | null }): string {
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
  const token =
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null) ||
    (typeof req.query.token === "string" ? req.query.token : null);

  if (!token) {
    res.status(401).json({ success: false, error: "Access denied. Authentication token required." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    const userDoc = await UserModel.findById(decoded.id).select(
      "_id email fullName role facilityId organization status isArchived"
    );

    if (
      !userDoc ||
      userDoc.status === "SUSPENDED" ||
      userDoc.status === "INACTIVE" ||
      userDoc.status === "ARCHIVED" ||
      userDoc.isArchived
    ) {
      res.status(403).json({ success: false, error: "User account suspended, deactivated, or not found." });
      return;
    }

    req.user = {
      id: userDoc._id.toString(),
      email: userDoc.email,
      fullName: userDoc.fullName,
      role: userDoc.role as Role,
      facilityId: userDoc.facilityId?.toString(),
      organization: userDoc.organization,
    };
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
