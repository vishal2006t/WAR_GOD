import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  Role,
  DispatchStatus,
  BatchStatus,
  DispatchModel,
  WasteBatchModel,
  ReceivingRecordModel,
  HandoverModel,
  FacilityModel,
  UserModel,
  WasteCategoryModel,
  DriverModel,
} from "../models";
import { blockchainService } from "../services/blockchain";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";
import { sendNotification } from "../services/notification";

const router = Router();

const receiveDispatchSchema = z.object({
  dispatchId: z.string().min(1),
  measuredWeightKg: z.number().positive(),
  acceptedWeightKg: z.number().nonnegative(),
  rejectedWeightKg: z.number().nonnegative().default(0),
  discrepancyReason: z.string().optional(),
  inspectionNotes: z.string().optional(),
  storageLocation: z.string().min(2),
  evidenceHash: z.string().optional(),
  isDisputed: z.boolean().default(false),
  otp: z.string().optional(),
});

// GET /api/receiving/incoming
router.get(
  "/incoming",
  authenticateToken,
  requireRole(Role.FACTORY, Role.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const where: any = {
        status: {
          $in: [
            DispatchStatus.IN_TRANSIT,
            DispatchStatus.ON_BREAK,
            DispatchStatus.ARRIVED_AT_FACTORY,
            DispatchStatus.DELIVERED,
          ],
        },
      };

      if (req.user!.role === Role.FACTORY && req.user!.facilityId) {
        where.destinationFacilityId = req.user!.facilityId;
      }

      const rawDispatches = await DispatchModel.find(where).sort({ updatedAt: -1 }).lean();

      const incoming = await Promise.all(
        rawDispatches.map(async (d: any) => {
          const idStr = d._id.toString();
          const driver = d.driverId
            ? await UserModel.findById(d.driverId).select("fullName phone").lean()
            : null;
          const destinationFacility = await FacilityModel.findById(d.destinationFacilityId).lean();

          const batches = await WasteBatchModel.find({
            $or: [
              { _id: { $in: d.batchIds || [] } },
              { batchId: { $in: d.batchIds || [] } },
            ],
          }).lean();

          const populatedBatches = await Promise.all(
            batches.map(async (b: any) => {
              const cat = await WasteCategoryModel.findById(b.categoryId).lean();
              const dealer = await UserModel.findById(b.dealerId).select("fullName").lean();
              return {
                batch: {
                  ...b,
                  id: b._id.toString(),
                  category: cat ? { ...cat, id: (cat as any)._id.toString() } : null,
                  dealer,
                },
              };
            })
          );

          return {
            ...d,
            id: idStr,
            driver,
            destinationFacility: destinationFacility
              ? { ...destinationFacility, id: (destinationFacility as any)._id.toString() }
              : null,
            batches: populatedBatches,
          };
        })
      );

      res.json({ success: true, incoming });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/receiving/history
router.get(
  "/history",
  authenticateToken,
  requireRole(Role.FACTORY, Role.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const where: any = {};
      if (req.user!.role === Role.FACTORY && req.user!.facilityId) {
        where.facilityId = req.user!.facilityId;
      }

      const rawRecords = await ReceivingRecordModel.find(where).sort({ createdAt: -1 }).lean();

      const records = await Promise.all(
        rawRecords.map(async (r: any) => {
          const idStr = r._id.toString();
          const batch = (await WasteBatchModel.findOne({
            $or: [{ _id: r.batchId }, { batchId: r.batchId }].filter(Boolean),
          }).lean()) as any;

          let populatedBatch = null;
          if (batch) {
            const cat = await WasteCategoryModel.findById(batch.categoryId).lean();
            const dealer = await UserModel.findById(batch.dealerId).select("fullName").lean();
            populatedBatch = {
              ...batch,
              id: batch._id.toString(),
              category: cat ? { ...cat, id: (cat as any)._id.toString() } : null,
              dealer,
            };
          }

          const dispatch = (await DispatchModel.findOne({
            $or: [{ _id: r.dispatchId }, { dispatchId: r.dispatchId }].filter(Boolean),
          }).lean()) as any;

          let populatedDispatch = null;
          if (dispatch) {
            const driver = dispatch.driverId
              ? await UserModel.findById(dispatch.driverId).select("fullName").lean()
              : null;
            populatedDispatch = {
              ...dispatch,
              id: dispatch._id.toString(),
              driver,
            };
          }

          const facility = await FacilityModel.findById(r.facilityId).lean();
          const receiverUser = await UserModel.findById(r.receiverUserId).select("fullName").lean();

          return {
            ...r,
            id: idStr,
            batch: populatedBatch,
            dispatch: populatedDispatch,
            facility: facility ? { ...facility, id: (facility as any)._id.toString() } : null,
            receiverUser,
          };
        })
      );

      res.json({ success: true, records });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/receiving/confirm
router.post(
  "/confirm",
  authenticateToken,
  requireRole(Role.FACTORY, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = receiveDispatchSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const {
        dispatchId,
        measuredWeightKg,
        acceptedWeightKg,
        rejectedWeightKg,
        discrepancyReason,
        inspectionNotes,
        storageLocation,
        evidenceHash,
        isDisputed,
        otp,
      } = parse.data;

      // Accepted + Rejected cannot exceed measured weight
      if (acceptedWeightKg + rejectedWeightKg > measuredWeightKg + 0.05) {
        res.status(400).json({
          success: false,
          error: `Accepted weight (${acceptedWeightKg}kg) + Rejected weight (${rejectedWeightKg}kg) cannot exceed measured weight (${measuredWeightKg}kg).`,
        });
        return;
      }

      const queryConditions: any[] = [{ dispatchId }];
      if (mongoose.Types.ObjectId.isValid(dispatchId)) {
        queryConditions.push({ _id: dispatchId });
      }

      const dispatch = await DispatchModel.findOne({ $or: queryConditions });

      if (!dispatch) {
        res.status(404).json({ success: false, error: "Dispatch not found" });
        return;
      }

      if (dispatch.status === DispatchStatus.RECEIVED) {
        res.status(400).json({ success: false, error: "Dispatch has already been received and confirmed." });
        return;
      }

      // If OTP is provided, validate it against the dispatch OTP
      if (otp && dispatch.deliveryConfirmationOtp && otp.trim() !== dispatch.deliveryConfirmationOtp.trim()) {
        res.status(400).json({
          success: false,
          error: "Invalid delivery confirmation OTP code. Please verify code with the carrier driver.",
        });
        return;
      }

      // Check for weight discrepancy between dispatched and received
      const weightDiff = Math.abs(dispatch.dispatchedWeightKg - measuredWeightKg);
      const hasDiscrepancy = weightDiff > 0.5 || isDisputed;

      if (hasDiscrepancy && !discrepancyReason) {
        res.status(400).json({
          success: false,
          error: `Weight difference detected (${weightDiff.toFixed(2)}kg discrepancy). A discrepancy reason is mandatory when weight difference exceeds tolerance.`,
        });
        return;
      }

      const finalStatus = hasDiscrepancy ? DispatchStatus.DISPUTED : DispatchStatus.RECEIVED;
      const batchStatus = hasDiscrepancy ? BatchStatus.DISPUTED : BatchStatus.RECEIVED;

      const proofHash =
        evidenceHash || computeSha256(dispatch.dispatchId + measuredWeightKg + (discrepancyReason || ""));

      // Record on Blockchain
      let txHash: string | null = null;
      try {
        txHash = await blockchainService.recordReceiving(
          dispatch.dispatchId,
          measuredWeightKg,
          proofHash,
          hasDiscrepancy
        );
      } catch (bcErr: any) {
        console.warn("Blockchain receiving notice:", bcErr.message);
      }

      const facilityId = req.user!.facilityId || dispatch.destinationFacilityId;

      // Update Dispatch
      const updatedDispatch = await DispatchModel.findByIdAndUpdate(
        dispatch._id,
        {
          status: finalStatus,
          receivedWeightKg: measuredWeightKg,
          discrepancyNotes: discrepancyReason,
          deliveryProofHash: proofHash,
          txHash,
          deliveryConfirmedAt: dispatch.deliveryConfirmedAt || new Date(),
          deliveryConfirmedByUserId: dispatch.deliveryConfirmedByUserId || req.user!.id,
        },
        { new: true }
      );

      if (dispatch.driverId) {
        const remainingActive = await DispatchModel.countDocuments({
          driverId: dispatch.driverId,
          _id: { $ne: dispatch._id },
          status: { $in: ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "PICKED_UP", "IN_TRANSIT"] },
        });
        if (remainingActive === 0) {
          await DriverModel.updateMany(
            { $or: [{ _id: dispatch.driverId }, { userId: dispatch.driverId }, { driverId: dispatch.driverId }] },
            { availability: "AVAILABLE", currentDispatchId: null }
          );
        }
      }

      // Find batches for this dispatch
      const batches = await WasteBatchModel.find({
        $or: [
          { _id: { $in: dispatch.batchIds || [] } },
          { batchId: { $in: dispatch.batchIds || [] } },
        ],
      });

      // Update batches & create receiving records
      for (const b of batches) {
        await WasteBatchModel.findByIdAndUpdate(b._id, { status: batchStatus });

        await ReceivingRecordModel.create({
          batchId: b._id.toString(),
          dispatchId: dispatch._id.toString(),
          facilityId,
          receiverUserId: req.user!.id,
          measuredWeightKg,
          acceptedWeightKg,
          rejectedWeightKg,
          isDisputed: hasDiscrepancy,
          discrepancyReason,
          inspectionNotes,
          storageLocation,
          evidenceHash: proofHash,
          txHash,
        });
      }

      // Create Handover record
      await HandoverModel.create({
        dispatchId: dispatch._id.toString(),
        senderUserId: dispatch.driverId || req.user!.id,
        receiverUserId: req.user!.id,
        handoverType: "DELIVERY_CONFIRMATION",
        evidenceHash: proofHash,
        notes: hasDiscrepancy
          ? `Delivery received with dispute: ${discrepancyReason} (Dispatched: ${dispatch.dispatchedWeightKg}kg, Measured: ${measuredWeightKg}kg)`
          : `Delivery received and verified intact at ${storageLocation}`,
      });

      await logAudit({
        userId: req.user!.id,
        action: hasDiscrepancy ? "RECEIVING_DISCREPANCY_FLAGGED" : "RECEIVING_CONFIRMED",
        entityType: "RECEIVING",
        entityId: dispatch.dispatchId,
        details: {
          dispatchedWeightKg: dispatch.dispatchedWeightKg,
          measuredWeightKg,
          acceptedWeightKg,
          hasDiscrepancy,
          discrepancyReason,
          txHash,
        },
        ipAddress: req.ip,
      });

      await sendNotification({
        role: Role.ADMIN,
        title: hasDiscrepancy ? "Weighbridge Discrepancy Flagged" : "Shipment Intake Verified",
        message: hasDiscrepancy
          ? `Facility flagged discrepancy on ${dispatch.dispatchId}: ${discrepancyReason || "Weight variance"}`
          : `Shipment ${dispatch.dispatchId} (${measuredWeightKg} kg) accepted into facility intake.`,
        type: hasDiscrepancy ? "ALERT" : "SUCCESS",
        entityType: "RECEIVING",
        entityId: dispatch.dispatchId,
      });

      if (dispatch.driverId) {
        await sendNotification({
          userId: dispatch.driverId,
          title: "Delivery Received",
          message: `Your delivery for ${dispatch.dispatchId} was processed by facility receiving.`,
          type: "INFO",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
        });
      }

      if (dispatch.dealerId) {
        await sendNotification({
          userId: dispatch.dealerId,
          title: "Shipment Delivery Officially Confirmed",
          message: `Carrier ${dispatch.vehicleRegistration} (Dispatch ${dispatch.dispatchId}) delivery was confirmed at facility intake (${measuredWeightKg} kg).`,
          type: "SUCCESS",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
          actionUrl: "/dealer#tracking",
        });
      }

      res.status(201).json({
        success: true,
        dispatch: updatedDispatch,
        discrepancyFlagged: hasDiscrepancy,
        message: hasDiscrepancy
          ? "Shipment received with discrepancy flag recorded."
          : "Shipment successfully verified and received.",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
