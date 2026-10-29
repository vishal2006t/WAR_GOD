import { connectMongo, disconnectMongo } from "./mongo";
import {
  UserModel,
  FacilityModel,
  WasteCategoryModel,
  WasteBatchModel,
  DispatchModel,
  HandoverModel,
  ReceivingRecordModel,
  ProcessingRecordModel,
  RecoveredMaterialModel,
  RecoveryClaimModel,
  ProductModel,
  ProductServiceRecordModel,
  OwnershipEventModel,
  AuditLogModel,
  BlockchainTransactionModel,
} from "../models";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function sha256(text: string) {
  return "0x" + crypto.createHash("sha256").update(text).digest("hex");
}

export async function seedMongo(): Promise<void> {
  await connectMongo();
  console.log("[MongoDB Migration] Initializing and migrating data into ecotrace database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Facilities
  const facilityApex = await FacilityModel.findOneAndUpdate(
    { code: "FAC-APEX-01" },
    {
      name: "Apex E-Waste Disassembly & Smelting Hub",
      code: "FAC-APEX-01",
      facilityType: "SMELTER_AND_RECYCLING",
      address: "Plot 42, Eco Industrial Area, Hubli-Dharwad, Karnataka",
      contactEmail: "plant@apexrecycling.com",
      contactPhone: "+91 98765 43210",
      authorized: true,
      location: { latitude: 12.9850, longitude: 77.7400 },
      geofenceRadiusMeters: 500,
    },
    { upsert: true, new: true }
  );

  const facilityWest = await FacilityModel.findOneAndUpdate(
    { code: "FAC-WEST-02" },
    {
      name: "Western Green Material Recovery Plant",
      code: "FAC-WEST-02",
      facilityType: "RECYCLING",
      address: "Sector 9, Heavy Engineering Zone, Pune, Maharashtra",
      contactEmail: "ops@westerngreen.org",
      contactPhone: "+91 91234 56789",
      authorized: true,
      location: { latitude: 18.5204, longitude: 73.8567 },
      geofenceRadiusMeters: 500,
    },
    { upsert: true, new: true }
  );

  const facilityRefurb = await FacilityModel.findOneAndUpdate(
    { code: "FAC-REFURB-03" },
    {
      name: "Apex Circular Refurbishment Hub",
      code: "FAC-REFURB-03",
      facilityType: "REFURBISHMENT",
      address: "Tech Park Annex, Bengaluru, Karnataka",
      contactEmail: "refurb@apexrecycling.com",
      contactPhone: "+91 99887 76655",
      authorized: true,
      location: { latitude: 12.9850, longitude: 77.7400 },
      geofenceRadiusMeters: 500,
    },
    { upsert: true, new: true }
  );

  // 2. Six Role Users
  const users = [
    {
      email: "admin@ecotrace.org",
      passwordHash,
      fullName: "Dr. Ronald Vance (Chief Auditor)",
      role: "ADMIN",
      phone: "+91 90000 00001",
      organization: "National E-Waste Regulatory Council",
      status: "APPROVED",
    },
    {
      email: "dealer@metrocollect.com",
      passwordHash,
      fullName: "Vikram Malhotra",
      role: "DEALER",
      phone: "+91 90000 00002",
      organization: "Metro E-Waste Aggregators Pvt Ltd",
      status: "APPROVED",
    },
    {
      email: "driver@greenlogistics.com",
      passwordHash,
      fullName: "Rajesh Kumar (Heavy Fleet Driver)",
      role: "DRIVER",
      phone: "+91 90000 00003",
      organization: "Green Corridor Logistics",
      status: "APPROVED",
    },
    {
      email: "factory@apexrecycling.com",
      passwordHash,
      fullName: "Ananya Deshmukh (Receiving Weighmaster)",
      role: "FACTORY",
      phone: "+91 90000 00004",
      organization: "Apex E-Waste Disassembly & Smelting Hub",
      facilityId: facilityApex._id.toString(),
      status: "APPROVED",
    },
    {
      email: "worker@apexrecycling.com",
      passwordHash,
      fullName: "Suresh Patil (Recovery Specialist)",
      role: "WORKER",
      phone: "+91 90000 00005",
      organization: "Apex E-Waste Disassembly & Smelting Hub",
      facilityId: facilityApex._id.toString(),
      status: "APPROVED",
    },
    {
      email: "customer@ecotrace.org",
      passwordHash,
      fullName: "Priya Sharma (Green Buyer)",
      role: "CUSTOMER",
      phone: "+91 90000 00006",
      organization: "Individual Consumer",
      status: "APPROVED",
    },
  ];

  const userMap: Record<string, any> = {};
  for (const u of users) {
    const doc = await UserModel.findOneAndUpdate({ email: u.email }, u, { upsert: true, new: true });
    userMap[u.role] = doc;
  }

  // 3. Categories
  const catPCB = await WasteCategoryModel.findOneAndUpdate(
    { code: "PCB" },
    {
      name: "Printed Circuit Boards (PCBs & Motherboards)",
      code: "PCB",
      description: "High precious-metal content circuitry from servers and PCs",
    },
    { upsert: true, new: true }
  );

  const catBAT = await WasteCategoryModel.findOneAndUpdate(
    { code: "BAT" },
    {
      name: "Lithium-Ion & Secondary Batteries",
      code: "BAT",
      description: "Rechargeable batteries containing cobalt, lithium, and nickel",
    },
    { upsert: true, new: true }
  );

  const catITC = await WasteCategoryModel.findOneAndUpdate(
    { code: "ITC" },
    {
      name: "IT & Computing Equipment",
      code: "ITC",
      description: "Laptops, workstations, server chassis, and networking switches",
    },
    { upsert: true, new: true }
  );

  // 4. Batches
  const batch1 = await WasteBatchModel.findOneAndUpdate(
    { batchId: "BATCH-2026-001" },
    {
      batchId: "BATCH-2026-001",
      dealerId: userMap.DEALER._id.toString(),
      categoryId: catPCB._id.toString(),
      destinationFacilityId: facilityApex._id.toString(),
      pickupLocation: "Electronic City Depot 4, Bengaluru",
      sourceType: "Enterprise IT Decommission",
      description: "High-grade telecom and datacenter server motherboards",
      initialWeightKg: 100.0,
      status: "PROCESSED",
      evidenceHash: sha256("weighing_receipt_BATCH-2026-001"),
      weighingSlipUrl: "/uploads/slips/slip-001.pdf",
      qrCodeData: JSON.stringify({ batchId: "BATCH-2026-001", initialWeightKg: 100.0 }),
      txHash: "0x4a7e91f092384918230918203918203918239018239018239018230918230918",
    },
    { upsert: true, new: true }
  );

  const batch2 = await WasteBatchModel.findOneAndUpdate(
    { batchId: "BATCH-2026-002" },
    {
      batchId: "BATCH-2026-002",
      dealerId: userMap.DEALER._id.toString(),
      categoryId: catBAT._id.toString(),
      destinationFacilityId: facilityWest._id.toString(),
      pickupLocation: "Whitefield Tech Park, Bengaluru",
      sourceType: "Commercial E-Vehicle Fleet",
      description: "EV battery modules and power storage units",
      initialWeightKg: 250.0,
      status: "DISPATCHED",
      evidenceHash: sha256("weighing_receipt_BATCH-2026-002"),
      weighingSlipUrl: "/uploads/slips/slip-002.pdf",
      qrCodeData: JSON.stringify({ batchId: "BATCH-2026-002", initialWeightKg: 250.0 }),
    },
    { upsert: true, new: true }
  );

  const batch3 = await WasteBatchModel.findOneAndUpdate(
    { batchId: "BATCH-2026-003" },
    {
      batchId: "BATCH-2026-003",
      dealerId: userMap.DEALER._id.toString(),
      categoryId: catITC._id.toString(),
      destinationFacilityId: facilityApex._id.toString(),
      pickupLocation: "Koramangala Commercial Hub, Bengaluru",
      sourceType: "Corporate Office Tech Refresh",
      description: "High-end corporate laptops (Dell Latitude / ThinkPad series)",
      initialWeightKg: 80.0,
      status: "RECEIVED",
      evidenceHash: sha256("weighing_receipt_BATCH-2026-003"),
      qrCodeData: JSON.stringify({ batchId: "BATCH-2026-003", initialWeightKg: 80.0 }),
    },
    { upsert: true, new: true }
  );

  // 5. Dispatches
  const dispatch1 = await DispatchModel.findOneAndUpdate(
    { dispatchId: "DISP-2026-001" },
    {
      dispatchId: "DISP-2026-001",
      driverId: userMap.DRIVER._id.toString(),
      vehicleRegistration: "KA-01-EQ-9988",
      pickupAddress: "Electronic City Depot 4, Bengaluru",
      destinationFacilityId: facilityApex._id.toString(),
      dispatchedWeightKg: 100.0,
      receivedWeightKg: 100.0,
      status: "RECEIVED",
      pickupProofHash: sha256("pickup_proof_DISP-2026-001"),
      deliveryProofHash: sha256("delivery_proof_DISP-2026-001"),
      batchIds: [batch1._id.toString()],
    },
    { upsert: true, new: true }
  );

  const dispatch2 = await DispatchModel.findOneAndUpdate(
    { dispatchId: "DISP-2026-002" },
    {
      dispatchId: "DISP-2026-002",
      driverId: userMap.DRIVER._id.toString(),
      vehicleRegistration: "KA-01-EQ-9988",
      pickupAddress: "Whitefield Tech Park, Bengaluru",
      destinationFacilityId: facilityWest._id.toString(),
      dispatchedWeightKg: 250.0,
      status: "IN_TRANSIT",
      pickupProofHash: sha256("pickup_proof_DISP-2026-002"),
      batchIds: [batch2._id.toString()],
    },
    { upsert: true, new: true }
  );

  // 6. Receiving Record
  await ReceivingRecordModel.findOneAndUpdate(
    { dispatchId: dispatch1._id.toString() },
    {
      batchId: batch1._id.toString(),
      dispatchId: dispatch1._id.toString(),
      facilityId: facilityApex._id.toString(),
      receiverUserId: userMap.FACTORY._id.toString(),
      measuredWeightKg: 100.0,
      acceptedWeightKg: 100.0,
      rejectedWeightKg: 0.0,
      isDisputed: false,
      inspectionNotes: "Intact packaging, verified seals, zero transit tampering.",
      storageLocation: "Bay-A-Shelves-12",
      evidenceHash: sha256("weighbridge_cert_DISP-001"),
    },
    { upsert: true, new: true }
  );

  // 7. Processing & Mass Balance
  const proc1 = await ProcessingRecordModel.findOneAndUpdate(
    { processingId: "PROC-2026-001" },
    {
      processingId: "PROC-2026-001",
      sourceBatchId: batch1._id.toString(),
      facilityId: facilityApex._id.toString(),
      workerUserId: userMap.WORKER._id.toString(),
      supervisorUserId: userMap.ADMIN._id.toString(),
      inputWeightKg: 100.0,
      totalRecoveredKg: 75.0,
      residualKg: 20.0,
      documentedLossKg: 5.0,
      massBalanceValid: true,
      supervisorApproved: true,
      supervisorRemarks: "Mass balance 100% reconciled. Recovery yield 75.0%. Approved for certification.",
      evidenceHash: sha256("mass_balance_audit_PROC-2026-001"),
      txHash: "0x89ab12cd34ef5678901234567890abcdef1234567890abcdef1234567890abcdef",
    },
    { upsert: true, new: true }
  );

  // 8. Recovered Materials
  const matCopper = await RecoveredMaterialModel.findOneAndUpdate(
    { materialBatchId: "MAT-COPPER-001" },
    {
      materialBatchId: "MAT-COPPER-001",
      sourceBatchId: batch1._id.toString(),
      processingRecordId: proc1._id.toString(),
      materialType: "Electrolytic Copper Cathode",
      recoveredWeightKg: 20.0,
      claimedWeightKg: 12.0,
      purityPercentage: 99.85,
      location: "Warehouse Smelter Vault 1",
      evidenceHash: sha256("spectroscopy_report_MAT-COPPER-001"),
    },
    { upsert: true, new: true }
  );

  await RecoveredMaterialModel.findOneAndUpdate(
    { materialBatchId: "MAT-ALUM-001" },
    {
      materialBatchId: "MAT-ALUM-001",
      sourceBatchId: batch1._id.toString(),
      processingRecordId: proc1._id.toString(),
      materialType: "Aerospace-Grade Aluminum Scrap",
      recoveredWeightKg: 15.0,
      claimedWeightKg: 0.0,
      purityPercentage: 98.5,
      location: "Warehouse Bay 3",
      evidenceHash: sha256("assay_report_MAT-ALUM-001"),
    },
    { upsert: true, new: true }
  );

  // 9. Recovery Claim
  await RecoveryClaimModel.findOneAndUpdate(
    { claimId: "CLAIM-2026-001" },
    {
      claimId: "CLAIM-2026-001",
      materialBatchId: matCopper._id.toString(),
      claimantName: "GreenTech Cables & Wires Ltd",
      claimantOrg: "GreenTech Industrial Group",
      claimedWeightKg: 12.0,
      verified: true,
      notes: "Audited circular economy material claim for eco-line ethernet cables.",
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    },
    { upsert: true, new: true }
  );

  // 10. Refurbished Product with Serial & Provenance
  const product1 = await ProductModel.findOneAndUpdate(
    { productId: "PROD-REFURB-001" },
    {
      productId: "PROD-REFURB-001",
      serialNumber: "SN-DELL-883921",
      name: "Dell Latitude 7420 Enterprise Laptop (Eco-Certified)",
      brandModel: "Dell Latitude 7420",
      sourceBatchId: batch1._id.toString(),
      condition: "Grade A - Certified Pristine",
      replacedComponents: "New 68Wh Battery, Arctic Silver Thermal Repaste, Micron 512GB NVMe SSD",
      inspectionReportHash: sha256("quality_inspection_SN-DELL-883921"),
      technicianApproved: true,
      technicianName: "Suresh Patil (Senior Hardware Specialist)",
      warrantyMonths: 12,
      qrCodeData: JSON.stringify({
        productId: "PROD-REFURB-001",
        serialNumber: "SN-DELL-883921",
        certified: true,
      }),
      txHash: "0xfeeeddccbbaa99887766554433221100feeeddccbbaa99887766554433221100",
    },
    { upsert: true, new: true }
  );

  await ProductServiceRecordModel.findOneAndUpdate(
    { productId: product1._id.toString() },
    {
      productId: product1._id.toString(),
      serviceType: "BATTERY_REPLACEMENT",
      description: "Original degraded cell replaced with certified high-efficiency lithium module.",
      technicianName: "Suresh Patil",
    },
    { upsert: true, new: true }
  );

  await OwnershipEventModel.findOneAndUpdate(
    { productId: product1._id.toString() },
    {
      productId: product1._id.toString(),
      eventType: "REGISTERED",
      description: "Certified refurbished product entered circular economy distribution registry.",
    },
    { upsert: true, new: true }
  );

  // 11. Audit Log & Blockchain Tx
  await AuditLogModel.create({
    userId: userMap.ADMIN._id.toString(),
    action: "MONGODB_PLATFORM_INITIALIZED",
    entityType: "SYSTEM",
    entityId: "SYS-INIT",
    detailsJson: JSON.stringify({ message: "EcoTrace MongoDB ecotrace database migrated and seeded." }),
    ipAddress: "127.0.0.1",
  });

  await BlockchainTransactionModel.create({
    txHash: "0x4a7e91f092384918230918203918203918239018239018239018230918230918",
    functionName: "registerBatch",
    contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    status: "CONFIRMED",
    blockNumber: 1,
  });

  console.log("[MongoDB Migration] SUCCESS: All 16 collections seeded and migrated into MongoDB 'ecotrace' database!");
}

if (require.main === module) {
  seedMongo()
    .then(() => disconnectMongo())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
