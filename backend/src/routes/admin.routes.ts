import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  Role,
  DispatchStatus,
  AccountStatus,
  WasteBatchModel,
  DispatchModel,
  ProcessingRecordModel,
  RecoveredMaterialModel,
  AuditLogModel,
  FacilityModel,
  ReceivingRecordModel,
  ProductModel,
  BlockchainTransactionModel,
  UserModel,
  DriverModel,
  WasteCategoryModel,
} from "../models";
import { logAudit } from "../services/audit";
import {
  generateCompleteAuditWorkbook,
  generateCollectionWorkbook,
  generateShipmentWorkbook,
  generateRecyclingWorkbook,
  generateMaterialsWorkbook,
  generateBlockchainWorkbook,
  generateAccountsWorkbook,
  generateComplianceWorkbook,
} from "../services/excelReport";
import { generateAuditWordDocument } from "../services/wordReport";

const router = Router();

// GET /api/admin/analytics (Live database calculations!)
router.get("/analytics", authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    // Total batches
    const totalBatches = await WasteBatchModel.countDocuments();
    const batches = await WasteBatchModel.find({}, "initialWeightKg status").lean();
    const totalCollectedWeightKg = Number(
      batches.reduce((acc: number, b: any) => acc + (b.initialWeightKg || 0), 0).toFixed(2)
    );

    // Dispatches
    const dispatches = await DispatchModel.find(
      {},
      "dispatchedWeightKg receivedWeightKg status"
    ).lean();
    const totalDispatchedWeightKg = Number(
      dispatches.reduce((acc: number, d: any) => acc + (d.dispatchedWeightKg || 0), 0).toFixed(2)
    );
    const totalReceivedWeightKg = Number(
      dispatches.reduce((acc: number, d: any) => acc + (d.receivedWeightKg || 0), 0).toFixed(2)
    );
    const inTransitShipments = dispatches.filter((d: any) => d.status === DispatchStatus.IN_TRANSIT).length;
    const pendingReceiving = dispatches.filter((d: any) => d.status === DispatchStatus.DELIVERED).length;
    const disputedShipments = dispatches.filter((d: any) => d.status === DispatchStatus.DISPUTED).length;

    // Processings & Mass-Balance
    const processings = await ProcessingRecordModel.find(
      {},
      "inputWeightKg totalRecoveredKg residualKg documentedLossKg massBalanceValid"
    ).lean();
    const totalInputProcessedKg = Number(
      processings.reduce((acc: number, p: any) => acc + (p.inputWeightKg || 0), 0).toFixed(2)
    );
    const totalRecoveredKg = Number(
      processings.reduce((acc: number, p: any) => acc + (p.totalRecoveredKg || 0), 0).toFixed(2)
    );
    const totalResidualKg = Number(
      processings.reduce((acc: number, p: any) => acc + (p.residualKg || 0), 0).toFixed(2)
    );
    const totalDocumentedLossKg = Number(
      processings.reduce((acc: number, p: any) => acc + (p.documentedLossKg || 0), 0).toFixed(2)
    );
    const recoveryYield =
      totalInputProcessedKg > 0
        ? Number(((totalRecoveredKg / totalInputProcessedKg) * 100).toFixed(2))
        : 0;
    const massBalanceFailures = processings.filter((p: any) => !p.massBalanceValid).length;

    // Recovered Materials by Category
    const materials = await RecoveredMaterialModel.find(
      {},
      "materialType recoveredWeightKg claimedWeightKg"
    ).lean();
    const materialSummary: Record<string, { recoveredKg: number; claimedKg: number }> = {};
    for (const m of materials as any[]) {
      if (!materialSummary[m.materialType]) {
        materialSummary[m.materialType] = { recoveredKg: 0, claimedKg: 0 };
      }
      materialSummary[m.materialType].recoveredKg += m.recoveredWeightKg;
      materialSummary[m.materialType].claimedKg += m.claimedWeightKg || 0;
    }

    // Duplicate Claim Rejections from Audit Logs
    const duplicateClaimAttempts = await AuditLogModel.countDocuments({
      action: "EXCESSIVE_CLAIM_REJECTED",
    });

    // Facility Compliance
    const facilities = await FacilityModel.find({}).lean();
    const facilityCompliance = await Promise.all(
      facilities.map(async (f: any) => {
        const idStr = f._id.toString();
        const totalReceivings = await ReceivingRecordModel.countDocuments({ facilityId: idStr });
        const disputes = await ReceivingRecordModel.countDocuments({
          facilityId: idStr,
          isDisputed: true,
        });

        return {
          id: idStr,
          name: f.name,
          code: f.code,
          type: f.facilityType,
          authorized: f.authorized,
          totalReceivings,
          disputes,
          complianceScore: disputes > 0 ? Math.max(70, 100 - disputes * 10) : 100,
        };
      })
    );

    // Refurbished Products
    const totalProducts = await ProductModel.countDocuments();

    // Blockchain Transactions
    const totalBlockchainTxs = await BlockchainTransactionModel.countDocuments();
    const confirmedBlockchainTxs = await BlockchainTransactionModel.countDocuments({
      status: "CONFIRMED",
    });

    res.json({
      success: true,
      metrics: {
        totalBatches,
        totalCollectedWeightKg,
        totalDispatchedWeightKg,
        totalReceivedWeightKg,
        inTransitShipments,
        pendingReceiving,
        disputedShipments,
        totalInputProcessedKg,
        totalRecoveredKg,
        totalResidualKg,
        totalDocumentedLossKg,
        recoveryYield,
        massBalanceFailures,
        duplicateClaimAttempts,
        totalProducts,
        totalBlockchainTxs,
        confirmedBlockchainTxs,
        materialSummary,
        facilityCompliance,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// USER MANAGEMENT & ROLE-BASED ACCESS CONTROL APIS
// -----------------------------------------------------------------------------

// Schema validation for creating new users
const createUserSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("A valid email address is required").toLowerCase(),
  role: z.enum(["ADMIN", "DEALER", "DRIVER", "FACTORY", "WORKER", "CUSTOMER"]),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  employeeId: z.string().optional(),
  phone: z.string().optional(),
  organization: z.string().optional(),
  facilityId: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED", "INACTIVE", "ARCHIVED"]).optional(),
});

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&");
}

// GET /api/admin/users (List, search, filter, and paginate users)
router.get("/users", authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    const { search, role, status, page, limit } = req.query;
    const filter: any = {};

    if (search && typeof search === "string" && search.trim()) {
      const sanitized = escapeRegex(search.trim());
      const searchRegex = new RegExp(sanitized, "i");
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { employeeId: searchRegex },
        { organization: searchRegex },
        { phone: searchRegex },
      ];
    }

    if (role && typeof role === "string" && role !== "ALL") {
      filter.role = role.toUpperCase();
    }

    if (status && typeof status === "string" && status !== "ALL") {
      filter.status = status.toUpperCase();
    }

    const pageNum = parseInt(String(page || "1"), 10) || 1;
    const limitNum = limit ? parseInt(String(limit), 10) : 0;
    const skip = limitNum > 0 ? (pageNum - 1) * limitNum : 0;

    const total = await UserModel.countDocuments(filter);
    const query = UserModel.find(filter).sort({ createdAt: -1 });
    if (limitNum > 0) {
      query.skip(skip).limit(limitNum);
    }
    const rawUsers = await query.lean();

    const users = await Promise.all(
      rawUsers.map(async (u: any) => {
        let facility = null;
        if (u.facilityId) {
          facility = await FacilityModel.findById(u.facilityId).select("name code").lean();
        }
        return {
          id: u._id.toString(),
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          status: u.status,
          employeeId: u.employeeId || null,
          phone: u.phone,
          organization: u.organization,
          facility,
          lastLoginAt: u.lastLoginAt || null,
          isArchived: Boolean(u.isArchived),
          archivedAt: u.archivedAt || null,
          statusReason: u.statusReason || null,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        };
      })
    );

    res.json({
      success: true,
      users,
      total,
      page: pageNum,
      limit: limitNum || total,
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/users/lookup/employee-id/:empId (Lookup candidate or employee ID)
router.get(
  "/users/lookup/employee-id/:empId",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { empId } = req.params;
      if (!empId || !empId.trim()) {
        res.status(400).json({ success: false, error: "Candidate/Employee ID is required." });
        return;
      }

      const cleanId = empId.trim();
      const user = await UserModel.findOne({
        $or: [
          { employeeId: { $regex: new RegExp(`^${cleanId}$`, "i") } },
          { _id: mongoose.Types.ObjectId.isValid(cleanId) ? cleanId : undefined },
        ].filter(Boolean),
      })
        .select("-passwordHash")
        .lean();

      if (user) {
        let facility = null;
        if (user.facilityId) {
          facility = await FacilityModel.findById(user.facilityId).select("name code").lean();
        }
        res.json({
          success: true,
          user: {
            ...user,
            id: user._id.toString(),
            facility,
          },
        });
        return;
      }

      // Check DriverModel fallback
      const driver = await DriverModel.findOne({
        driverId: { $regex: new RegExp(`^${cleanId}$`, "i") },
      }).lean();

      if (driver && driver.userId) {
        const linkedUser = await UserModel.findById(driver.userId).select("-passwordHash").lean();
        if (linkedUser) {
          res.json({
            success: true,
            user: {
              ...linkedUser,
              id: linkedUser._id.toString(),
              driverDetails: driver,
            },
          });
          return;
        }
      }

      res.status(404).json({
        success: false,
        error: `No candidate or employee found with ID '${cleanId}'.`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/admin/users/:id (View authorized user profile + assigned work summary + recent audits)
router.get(
  "/users/:id",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, error: "Invalid user ID format." });
        return;
      }

      const user = await UserModel.findById(id).select("-passwordHash").lean();
      if (!user) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }

      let facility = null;
      if (user.facilityId) {
        facility = await FacilityModel.findById(user.facilityId).select("name code address").lean();
      }

      // Summarize assigned operational work based on role
      let assignedWork: any = null;
      if (user.role === Role.DRIVER) {
        const driverIds = [id, user.employeeId].filter(Boolean);
        const dispatches = await DispatchModel.find({
          driverId: { $in: driverIds },
        })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean();
        const activeCount = await DispatchModel.countDocuments({
          driverId: { $in: driverIds },
          status: { $in: [DispatchStatus.ASSIGNED, DispatchStatus.ACCEPTED, DispatchStatus.IN_TRANSIT, DispatchStatus.ON_BREAK] },
        });
        assignedWork = {
          roleType: "DRIVER",
          totalDispatches: await DispatchModel.countDocuments({ driverId: { $in: driverIds } }),
          activeDispatchesCount: activeCount,
          recentDispatches: dispatches.map((d: any) => ({
            id: d._id.toString(),
            dispatchId: d.dispatchId,
            status: d.status,
            vehicleRegistration: d.vehicleRegistration,
            origin: d.originAddress,
            destination: d.destinationFacility,
            createdAt: d.createdAt,
          })),
        };
      } else if (user.role === Role.DEALER) {
        const batches = await WasteBatchModel.find({ dealerId: id })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean();
        assignedWork = {
          roleType: "DEALER",
          totalBatches: await WasteBatchModel.countDocuments({ dealerId: id }),
          recentBatches: batches.map((b: any) => ({
            id: b._id.toString(),
            batchId: b.batchId,
            weightKg: b.initialWeightKg,
            status: b.status,
            createdAt: b.createdAt,
          })),
        };
      } else if (user.role === Role.WORKER) {
        const processing = await ProcessingRecordModel.find({ workerUserId: id })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean();
        assignedWork = {
          roleType: "WORKER",
          totalProcessingRecords: await ProcessingRecordModel.countDocuments({ workerUserId: id }),
          recentProcessing: processing.map((p: any) => ({
            id: p._id.toString(),
            batchId: p.batchId,
            processedWeightKg: p.processedWeightKg,
            recoveredWeightKg: p.recoveredWeightKg,
            createdAt: p.createdAt,
          })),
        };
      }

      // Recent audit events for this user
      const auditHistory = await AuditLogModel.find({
        $or: [{ entityId: id }, { userId: id }],
      })
        .sort({ timestamp: -1 })
        .limit(15)
        .lean();

      res.json({
        success: true,
        user: {
          ...user,
          id: user._id.toString(),
          facility,
        },
        assignedWork,
        auditHistory: auditHistory.map((a: any) => ({
          id: a._id.toString(),
          action: a.action,
          timestamp: a.timestamp,
          ipAddress: a.ipAddress,
          details: a.detailsJson ? JSON.parse(a.detailsJson) : null,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/admin/users/:id/audit-history (User audit log trail)
router.get(
  "/users/:id/audit-history",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const logs = await AuditLogModel.find({
        $or: [{ entityId: id }, { userId: id }],
      })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      res.json({
        success: true,
        auditLogs: logs.map((l: any) => ({
          ...l,
          id: l._id.toString(),
          details: l.detailsJson ? JSON.parse(l.detailsJson) : null,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/admin/users (Create a new user account with role assignment)
router.post(
  "/users",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = createUserSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Validation error: Please review user inputs.",
          details: parse.error.format(),
        });
        return;
      }

      const { fullName, email, role, password, employeeId, phone, organization, facilityId, status } =
        parse.data;

      // Unique email check
      const existingEmail = await UserModel.findOne({ email: email.toLowerCase().trim() });
      if (existingEmail) {
        res.status(409).json({
          success: false,
          error: `An account with email '${email.toLowerCase()}' already exists.`,
        });
        return;
      }

      // Unique Employee / Candidate ID check (if provided)
      let cleanEmpId: string | undefined = undefined;
      if (employeeId && employeeId.trim()) {
        cleanEmpId = employeeId.trim().toUpperCase();
        const existingEmp = await UserModel.findOne({ employeeId: cleanEmpId });
        if (existingEmp) {
          res.status(409).json({
            success: false,
            error: `Employee/Candidate ID '${cleanEmpId}' is already assigned to ${existingEmp.fullName} (${existingEmp.email}).`,
          });
          return;
        }
      }

      // Password generation / hashing
      const passwordToUse = password && password.trim().length >= 6
        ? password
        : `EcoTrace@${Math.floor(100000 + Math.random() * 900000)}`;
      const passwordHash = await bcrypt.hash(passwordToUse, 10);

      // Verify facility if provided
      if (facilityId) {
        const fac = await FacilityModel.findById(facilityId);
        if (!fac) {
          res.status(400).json({ success: false, error: "Specified facility does not exist." });
          return;
        }
      }

      const newUser = await UserModel.create({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        employeeId: cleanEmpId,
        phone: phone ? phone.trim() : undefined,
        organization: organization ? organization.trim() : undefined,
        facilityId: facilityId || undefined,
        status: status || "APPROVED",
        isArchived: false,
      });

      // Audit log entry
      await logAudit({
        userId: req.user!.id,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: newUser._id.toString(),
        details: {
          createdUserEmail: newUser.email,
          createdUserRole: newUser.role,
          createdUserFullName: newUser.fullName,
          employeeId: cleanEmpId,
          status: newUser.status,
        },
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        message: "User account created successfully.",
        user: {
          id: newUser._id.toString(),
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          employeeId: newUser.employeeId,
          status: newUser.status,
          phone: newUser.phone,
          organization: newUser.organization,
          facilityId: newUser.facilityId,
          createdAt: newUser.createdAt,
        },
        temporaryPassword: password ? undefined : passwordToUse,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// PATCH /api/admin/users/:id (Update permitted user details)
router.patch(
  "/users/:id",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, error: "Invalid user ID format." });
        return;
      }

      const user = await UserModel.findById(id);
      if (!user) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }

      const { fullName, phone, organization, facilityId, employeeId } = req.body;
      const previousValues: any = {};
      const newValues: any = {};

      if (fullName && typeof fullName === "string" && fullName.trim().length >= 2) {
        previousValues.fullName = user.fullName;
        user.fullName = fullName.trim();
        newValues.fullName = user.fullName;
      }

      if (phone !== undefined) {
        previousValues.phone = user.phone;
        user.phone = phone ? String(phone).trim() : undefined;
        newValues.phone = user.phone;
      }

      if (organization !== undefined) {
        previousValues.organization = user.organization;
        user.organization = organization ? String(organization).trim() : undefined;
        newValues.organization = user.organization;
      }

      if (facilityId !== undefined) {
        if (facilityId && !mongoose.Types.ObjectId.isValid(facilityId)) {
          res.status(400).json({ success: false, error: "Invalid facility ID format." });
          return;
        }
        previousValues.facilityId = user.facilityId;
        user.facilityId = facilityId || undefined;
        newValues.facilityId = user.facilityId;
      }

      if (employeeId !== undefined) {
        const cleanEmpId = employeeId ? String(employeeId).trim().toUpperCase() : undefined;
        if (cleanEmpId) {
          const duplicate = await UserModel.findOne({
            employeeId: cleanEmpId,
            _id: { $ne: user._id },
          });
          if (duplicate) {
            res.status(409).json({
              success: false,
              error: `Employee ID '${cleanEmpId}' is already assigned to ${duplicate.fullName}.`,
            });
            return;
          }
        }
        previousValues.employeeId = user.employeeId;
        user.employeeId = cleanEmpId;
        newValues.employeeId = cleanEmpId;
      }

      await user.save();

      await logAudit({
        userId: req.user!.id,
        action: "USER_UPDATED",
        entityType: "USER",
        entityId: user._id.toString(),
        details: { previousValues, newValues },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "User profile updated successfully.",
        user: {
          id: user._id.toString(),
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          employeeId: user.employeeId,
          status: user.status,
          phone: user.phone,
          organization: user.organization,
          facilityId: user.facilityId,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// PATCH /api/admin/users/:id/role (Change user role with authorization & safety gates)
router.patch(
  "/users/:id/role",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { role, reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, error: "Invalid user ID format." });
        return;
      }

      const validRoles = ["ADMIN", "DEALER", "DRIVER", "FACTORY", "WORKER", "CUSTOMER"];
      if (!role || !validRoles.includes(role)) {
        res.status(400).json({
          success: false,
          error: `Invalid role '${role}'. Supported roles: ${validRoles.join(", ")}`,
        });
        return;
      }

      const targetUser = await UserModel.findById(id);
      if (!targetUser) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }

      if (targetUser.role === role) {
        res.status(400).json({
          success: false,
          error: `User already has the role '${role}'.`,
        });
        return;
      }

      // Safety check: Prevent demoting the last active Administrator
      if (targetUser.role === Role.ADMIN && role !== Role.ADMIN) {
        const activeAdmins = await UserModel.countDocuments({
          role: Role.ADMIN,
          status: "APPROVED",
          isArchived: { $ne: true },
          _id: { $ne: targetUser._id },
        });
        if (activeAdmins === 0) {
          res.status(400).json({
            success: false,
            error: "Cannot change role of the last active Administrator. The system must retain at least one active Admin.",
          });
          return;
        }
      }

      const previousRole = targetUser.role;
      targetUser.role = role;
      await targetUser.save();

      await logAudit({
        userId: req.user!.id,
        action: "USER_ROLE_CHANGED",
        entityType: "USER",
        entityId: targetUser._id.toString(),
        details: {
          previousRole,
          newRole: role,
          reason: reason || "Role reassigned by Administrator",
        },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: `Role changed from ${previousRole} to ${role} successfully.`,
        user: {
          id: targetUser._id.toString(),
          email: targetUser.email,
          fullName: targetUser.fullName,
          role: targetUser.role,
          status: targetUser.status,
          employeeId: targetUser.employeeId,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// PATCH /api/admin/users/:id/status (Activate, deactivate, suspend, or reactivate accounts)
router.patch(
  "/users/:id/status",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, error: "Invalid user ID format." });
        return;
      }

      if (!status || !Object.values(AccountStatus).includes(status)) {
        res.status(400).json({
          success: false,
          error: `Invalid status value '${status}'. Allowed: ${Object.values(AccountStatus).join(", ")}`,
        });
        return;
      }

      const targetUser = await UserModel.findById(id);
      if (!targetUser) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }

      // Safety check: Prevent deactivating or suspending the last active Admin
      if (
        targetUser.role === Role.ADMIN &&
        (status === "SUSPENDED" || status === "INACTIVE" || status === "ARCHIVED")
      ) {
        const activeAdmins = await UserModel.countDocuments({
          role: Role.ADMIN,
          status: "APPROVED",
          isArchived: { $ne: true },
          _id: { $ne: targetUser._id },
        });
        if (activeAdmins === 0) {
          res.status(400).json({
            success: false,
            error: "Cannot deactivate or suspend the last active Administrator.",
          });
          return;
        }
      }

      const previousStatus = targetUser.status;
      targetUser.status = status;
      if (reason) targetUser.statusReason = reason;
      if (status === "APPROVED") {
        targetUser.isArchived = false;
      }
      await targetUser.save();

      const action =
        status === "APPROVED"
          ? "USER_REACTIVATED"
          : status === "SUSPENDED" || status === "INACTIVE"
          ? "USER_DEACTIVATED"
          : "USER_STATUS_UPDATED";

      await logAudit({
        userId: req.user!.id,
        action,
        entityType: "USER",
        entityId: targetUser._id.toString(),
        details: { previousStatus, newStatus: status, reason: reason || null },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: `Account status updated from ${previousStatus} to ${status}.`,
        user: {
          id: targetUser._id.toString(),
          email: targetUser.email,
          fullName: targetUser.fullName,
          role: targetUser.role,
          status: targetUser.status,
          employeeId: targetUser.employeeId,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// DELETE /api/admin/users/:id (Archive user account with safety gates & operational preservation)
router.delete(
  "/users/:id",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const reason = (req.body && req.body.reason) || (req.query && req.query.reason);

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, error: "Invalid user ID format." });
        return;
      }

      // Safety check 1: Cannot delete currently authenticated Admin
      if (req.user!.id === id) {
        res.status(400).json({
          success: false,
          error: "You cannot delete or archive your own active Administrator account.",
        });
        return;
      }

      const targetUser = await UserModel.findById(id);
      if (!targetUser) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }

      // Safety check 2: Prevent deletion of last active Admin
      if (targetUser.role === Role.ADMIN) {
        const activeAdmins = await UserModel.countDocuments({
          role: Role.ADMIN,
          status: "APPROVED",
          isArchived: { $ne: true },
          _id: { $ne: targetUser._id },
        });
        if (activeAdmins === 0) {
          res.status(400).json({
            success: false,
            error: "Cannot remove the last active Administrator. System must retain at least one active Admin.",
          });
          return;
        }
      }

      // Safety check 3: If DRIVER, require reassignment of active/in-transit dispatches
      if (targetUser.role === Role.DRIVER) {
        const driverIds = [id, targetUser.employeeId].filter(Boolean);
        const activeDispatches = await DispatchModel.countDocuments({
          driverId: { $in: driverIds },
          status: { $in: [DispatchStatus.ASSIGNED, DispatchStatus.ACCEPTED, DispatchStatus.IN_TRANSIT, DispatchStatus.ON_BREAK] },
        });
        if (activeDispatches > 0) {
          res.status(400).json({
            success: false,
            error: `Cannot archive driver account: Driver has ${activeDispatches} active or in-transit dispatch(es). Dispatches must be reassigned or completed before archiving.`,
          });
          return;
        }
      }

      // Perform soft deletion / archival to preserve provenance and business records
      targetUser.status = "ARCHIVED";
      targetUser.isArchived = true;
      targetUser.archivedAt = new Date();
      targetUser.archivedBy = req.user!.id;
      targetUser.statusReason = typeof reason === "string" ? reason : "Account archived by Administrator";
      await targetUser.save();

      await logAudit({
        userId: req.user!.id,
        action: "USER_ARCHIVED",
        entityType: "USER",
        entityId: targetUser._id.toString(),
        details: {
          archivedUserEmail: targetUser.email,
          archivedUserRole: targetUser.role,
          reason: targetUser.statusReason,
        },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "User account archived successfully. Historical dispatches, batches, and audit logs preserved.",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/admin/audit-logs or /api/admin/audits
router.get(["/audit-logs", "/audits"], authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    const { action, entityType } = req.query;
    const where: any = {};
    if (action) where.action = String(action);
    if (entityType) where.entityType = String(entityType);

    const rawLogs = await AuditLogModel.find(where).sort({ timestamp: -1 }).limit(100).lean();

    const logs = await Promise.all(
      rawLogs.map(async (l: any) => {
        let user = null;
        if (l.userId) {
          user = await UserModel.findById(l.userId).select("fullName role email").lean();
        }
        return {
          ...l,
          id: l._id.toString(),
          user,
        };
      })
    );

    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/blockchain/txs
router.get(
  "/blockchain/txs",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const rawTxs = await BlockchainTransactionModel.find({}).sort({ timestamp: -1 }).limit(100).lean();
      const transactions = rawTxs.map((t: any) => ({ ...t, id: t._id.toString() }));
      res.json({ success: true, transactions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// Shared Word (.docx) Audit Report Handler
async function handleWordAuditExport(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = req.user
      ? await UserModel.findById(req.user.id).select("fullName email").lean()
      : undefined;

    const { buffer, filename } = await generateAuditWordDocument(adminUser);

    await logAudit({
      userId: req.user!.id,
      action: "AUDIT_REPORT_EXPORTED_DOCX",
      entityType: "AUDIT_REPORT",
      entityId: "AUDIT_DOCX",
      details: { filename, format: "docx", byteLength: buffer.length },
      ipAddress: req.ip,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(buffer);
  } catch (err: any) {
    console.error("[Word Audit Export Error]", err);
    res.status(500).json({
      success: false,
      error: `Word audit export failed: ${err.message || "Unknown error"}`,
    });
  }
}

// GET /api/admin/export/word (Genuine Microsoft Word .docx audit report)
router.get("/export/word", authenticateToken, requireRole(Role.ADMIN), handleWordAuditExport);
router.get("/export/docx", authenticateToken, requireRole(Role.ADMIN), handleWordAuditExport);
router.get("/export/audit-export", authenticateToken, requireRole(Role.ADMIN), handleWordAuditExport);
router.get("/export/audit", authenticateToken, requireRole(Role.ADMIN), handleWordAuditExport);
router.get("/export/audit-docx", authenticateToken, requireRole(Role.ADMIN), handleWordAuditExport);

// GET /api/admin/export/csv
router.get("/export/csv", authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    // If client requested docx format via query parameter, delegate to Word export handler
    if (req.query.format === "docx" || req.query.format === "word") {
      return handleWordAuditExport(req, res);
    }

    const rawBatches = await WasteBatchModel.find({}).sort({ createdAt: -1 }).lean();

    const batches = await Promise.all(
      rawBatches.map(async (b: any) => {
        const idStr = b._id.toString();
        const category = await WasteCategoryModel.findById(b.categoryId).lean();
        const destinationFacility = await FacilityModel.findById(b.destinationFacilityId).lean();
        const dealer = await UserModel.findById(b.dealerId).select("fullName").lean();
        const receivingRecord = await ReceivingRecordModel.findOne({
          $or: [{ batchId: idStr }, { batchId: b.batchId }],
        }).lean();
        const processingRecords = await ProcessingRecordModel.find({
          $or: [{ sourceBatchId: idStr }, { sourceBatchId: b.batchId }],
        }).lean();

        return {
          ...b,
          category,
          destinationFacility,
          dealer,
          receivingRecord,
          processingRecords,
        };
      })
    );

    const headers = [
      "Batch ID",
      "Category",
      "Initial Weight (kg)",
      "Status",
      "Dealer",
      "Destination Facility",
      "Measured Received (kg)",
      "Processed (kg)",
      "Recovered (kg)",
      "Blockchain Tx",
      "Created At",
    ];

    const rows = batches.map((b: any) => [
      b.batchId,
      `"${b.category?.name || "N/A"}"`,
      b.initialWeightKg,
      b.status,
      `"${b.dealer?.fullName || "N/A"}"`,
      `"${b.destinationFacility?.name || "N/A"}"`,
      b.receivingRecord?.measuredWeightKg ?? "N/A",
      b.processingRecords[0]?.inputWeightKg ?? "N/A",
      b.processingRecords[0]?.totalRecoveredKg ?? "N/A",
      b.txHash ?? "N/A",
      `"${new Date(b.createdAt).toISOString()}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const dateStr = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=ecotrace-audit-export-${dateStr}.csv`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/export/excel/:reportType (Genuine Excel .xlsx downloads)
router.get(
  "/export/excel/:reportType",
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportType } = req.params;
      const { startDate, endDate } = req.query;
      const filter = {
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      };

      let workbook;
      let filename = `ecotrace-${reportType}-report.xlsx`;

      switch (reportType.toLowerCase()) {
        case "complete":
        case "all":
        case "master":
          workbook = await generateCompleteAuditWorkbook(filter);
          filename = "ecotrace-complete-audit-report.xlsx";
          break;
        case "collection":
        case "batches":
          workbook = await generateCollectionWorkbook(filter);
          filename = "ecotrace-collection-batches-report.xlsx";
          break;
        case "shipment":
        case "dispatches":
        case "logistics":
          workbook = await generateShipmentWorkbook(filter);
          filename = "ecotrace-shipments-logistics-report.xlsx";
          break;
        case "recycling":
        case "mass-balance":
        case "processing":
          workbook = await generateRecyclingWorkbook(filter);
          filename = "ecotrace-recycling-massbalance-report.xlsx";
          break;
        case "materials":
        case "claims":
        case "recovery":
          workbook = await generateMaterialsWorkbook(filter);
          filename = "ecotrace-material-claims-report.xlsx";
          break;
        case "blockchain":
        case "ledger":
        case "txs":
          workbook = await generateBlockchainWorkbook(filter);
          filename = "ecotrace-blockchain-ledger-report.xlsx";
          break;
        case "users":
        case "accounts":
        case "activity":
          workbook = await generateAccountsWorkbook();
          filename = "ecotrace-accounts-activity-report.xlsx";
          break;
        case "compliance":
        case "disputes":
        case "facilities":
          workbook = await generateComplianceWorkbook();
          filename = "ecotrace-facility-compliance-report.xlsx";
          break;
        default:
          res.status(400).json({
            success: false,
            error: `Invalid reportType '${reportType}'. Valid types: complete, collection, shipment, recycling, materials, blockchain, users, compliance.`,
          });
          return;
      }

      await logAudit({
        userId: req.user!.id,
        action: "EXCEL_REPORT_EXPORTED",
        entityType: "AUDIT_REPORT",
        entityId: reportType,
        details: { reportType, filter, filename },
        ipAddress: req.ip,
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (err: any) {
      console.error("[Excel Export Error]", err);
      res.status(500).json({
        success: false,
        error: `Excel export failed: ${err.message || "Unknown error"}`,
      });
    }
  }
);

export default router;
