import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role, BatchStatus, DispatchStatus, AccountStatus } from "@prisma/client";
import { logAudit } from "../services/audit";

const router = Router();

// GET /api/admin/analytics (Live database calculations!)
router.get("/analytics", authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    // Total batches
    const totalBatches = await prisma.wasteBatch.count();
    const batches = await prisma.wasteBatch.findMany({ select: { initialWeightKg: true, status: true } });
    const totalCollectedWeightKg = Number(batches.reduce((acc, b) => acc + b.initialWeightKg, 0).toFixed(2));

    // Dispatches
    const dispatches = await prisma.dispatch.findMany({
      select: { dispatchedWeightKg: true, receivedWeightKg: true, status: true },
    });
    const totalDispatchedWeightKg = Number(dispatches.reduce((acc, d) => acc + d.dispatchedWeightKg, 0).toFixed(2));
    const totalReceivedWeightKg = Number(
      dispatches.reduce((acc, d) => acc + (d.receivedWeightKg || 0), 0).toFixed(2)
    );
    const inTransitShipments = dispatches.filter((d) => d.status === DispatchStatus.IN_TRANSIT).length;
    const pendingReceiving = dispatches.filter((d) => d.status === DispatchStatus.DELIVERED).length;
    const disputedShipments = dispatches.filter((d) => d.status === DispatchStatus.DISPUTED).length;

    // Processings & Mass-Balance
    const processings = await prisma.processingRecord.findMany({
      select: { inputWeightKg: true, totalRecoveredKg: true, residualKg: true, documentedLossKg: true, massBalanceValid: true },
    });
    const totalInputProcessedKg = Number(processings.reduce((acc, p) => acc + p.inputWeightKg, 0).toFixed(2));
    const totalRecoveredKg = Number(processings.reduce((acc, p) => acc + p.totalRecoveredKg, 0).toFixed(2));
    const totalResidualKg = Number(processings.reduce((acc, p) => acc + p.residualKg, 0).toFixed(2));
    const totalDocumentedLossKg = Number(processings.reduce((acc, p) => acc + p.documentedLossKg, 0).toFixed(2));
    const recoveryYield = totalInputProcessedKg > 0 ? Number(((totalRecoveredKg / totalInputProcessedKg) * 100).toFixed(2)) : 0;
    const massBalanceFailures = processings.filter((p) => !p.massBalanceValid).length;

    // Recovered Materials by Category
    const materials = await prisma.recoveredMaterial.findMany({
      select: { materialType: true, recoveredWeightKg: true, claimedWeightKg: true },
    });
    const materialSummary: Record<string, { recoveredKg: number; claimedKg: number }> = {};
    for (const m of materials) {
      if (!materialSummary[m.materialType]) {
        materialSummary[m.materialType] = { recoveredKg: 0, claimedKg: 0 };
      }
      materialSummary[m.materialType].recoveredKg += m.recoveredWeightKg;
      materialSummary[m.materialType].claimedKg += m.claimedWeightKg;
    }

    // Duplicate Claim Rejections from Audit Logs
    const duplicateClaimAttempts = await prisma.auditLog.count({
      where: { action: "EXCESSIVE_CLAIM_REJECTED" },
    });

    // Facility Compliance
    const facilities = await prisma.facility.findMany({
      include: {
        receivingRecords: { select: { isDisputed: true } },
        processingRecords: { select: { massBalanceValid: true } },
      },
    });

    const facilityCompliance = facilities.map((f) => {
      const disputes = f.receivingRecords.filter((r) => r.isDisputed).length;
      const invalidMb = f.processingRecords.filter((p) => !p.massBalanceValid).length;
      return {
        id: f.id,
        name: f.name,
        code: f.code,
        type: f.facilityType,
        authorized: f.authorized,
        totalReceivings: f.receivingRecords.length,
        disputes,
        complianceScore: disputes > 0 ? Math.max(70, 100 - disputes * 10) : 100,
      };
    });

    // Refurbished Products
    const totalProducts = await prisma.product.count();

    // Blockchain Transactions
    const totalBlockchainTxs = await prisma.blockchainTransaction.count();
    const confirmedBlockchainTxs = await prisma.blockchainTransaction.count({ where: { status: "CONFIRMED" } });

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

// GET /api/admin/users
router.get("/users", authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        organization: true,
        facility: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/users/:id/status (Approve or suspend accounts)
router.patch("/users/:id/status", authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(AccountStatus).includes(status)) {
      res.status(400).json({ success: false, error: "Invalid status value" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    await logAudit({
      userId: req.user!.id,
      action: "USER_STATUS_UPDATED",
      entityType: "USER",
      entityId: id,
      details: { newStatus: status },
      ipAddress: req.ip,
    });

    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/audit-logs
router.get("/audit-logs", authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    const { action, entityType } = req.query;
    const where: any = {};
    if (action) where.action = String(action);
    if (entityType) where.entityType = String(entityType);

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { fullName: true, role: true, email: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 100,
    });

    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/blockchain/txs
router.get("/blockchain/txs", authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.blockchainTransaction.findMany({
      orderBy: { timestamp: "desc" },
      take: 100,
    });
    res.json({ success: true, transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/export/csv
router.get("/export/csv", authenticateToken, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    const batches = await prisma.wasteBatch.findMany({
      include: {
        category: true,
        destinationFacility: true,
        dealer: { select: { fullName: true } },
        receivingRecord: true,
        processingRecords: true,
      },
      orderBy: { createdAt: "desc" },
    });

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

    const rows = batches.map((b) => [
      b.batchId,
      `"${b.category.name}"`,
      b.initialWeightKg,
      b.status,
      `"${b.dealer.fullName}"`,
      `"${b.destinationFacility.name}"`,
      b.receivingRecord?.measuredWeightKg ?? "N/A",
      b.processingRecords[0]?.inputWeightKg ?? "N/A",
      b.processingRecords[0]?.totalRecoveredKg ?? "N/A",
      b.txHash ?? "N/A",
      `"${b.createdAt.toISOString()}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=ecotrace-audit-export.csv");
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
