import { PrismaClient, Role, BatchStatus, DispatchStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function main() {
  console.log("Seeding EcoTrace database...");

  // Clear existing data in reverse order of dependencies
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.blockchainTransaction.deleteMany();
  await prisma.evidenceFile.deleteMany();
  await prisma.ownershipEvent.deleteMany();
  await prisma.productServiceRecord.deleteMany();
  await prisma.product.deleteMany();
  await prisma.recoveryClaim.deleteMany();
  await prisma.recoveredMaterial.deleteMany();
  await prisma.processingRecord.deleteMany();
  await prisma.receivingRecord.deleteMany();
  await prisma.handover.deleteMany();
  await prisma.dispatchBatch.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.wasteBatch.deleteMany();
  await prisma.wasteCategory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.facility.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Create Facilities
  const facilityApex = await prisma.facility.create({
    data: {
      name: "Apex E-Waste Disassembly & Smelting Hub",
      code: "FAC-APEX-01",
      facilityType: "SMELTER_AND_RECYCLING",
      address: "Plot 42, Eco Industrial Area, Hubli-Dharwad, Karnataka",
      contactEmail: "plant@apexrecycling.com",
      contactPhone: "+91 98765 43210",
      authorized: true,
    },
  });

  const facilityWest = await prisma.facility.create({
    data: {
      name: "Western Green Material Recovery Plant",
      code: "FAC-WEST-02",
      facilityType: "RECYCLING",
      address: "Sector 9, Heavy Engineering Zone, Pune, Maharashtra",
      contactEmail: "ops@westerngreen.org",
      contactPhone: "+91 91234 56789",
      authorized: true,
    },
  });

  const facilityRefurb = await prisma.facility.create({
    data: {
      name: "Apex Circular Refurbishment Hub",
      code: "FAC-REFURB-03",
      facilityType: "REFURBISHMENT",
      address: "Tech Park Annex, Bengaluru, Karnataka",
      contactEmail: "refurb@apexrecycling.com",
      contactPhone: "+91 99887 76655",
      authorized: true,
    },
  });

  // 2. Create Six Role Users
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@ecotrace.org",
      passwordHash,
      fullName: "Dr. Ronald Vance (Chief Auditor)",
      role: Role.ADMIN,
      phone: "+91 90000 00001",
      organization: "National E-Waste Regulatory Council",
    },
  });

  const dealerUser = await prisma.user.create({
    data: {
      email: "dealer@metrocollect.com",
      passwordHash,
      fullName: "Vikram Malhotra",
      role: Role.DEALER,
      phone: "+91 90000 00002",
      organization: "Metro E-Waste Aggregators Pvt Ltd",
    },
  });

  const driverUser = await prisma.user.create({
    data: {
      email: "driver@greenlogistics.com",
      passwordHash,
      fullName: "Rajesh Kumar (Heavy Fleet Driver)",
      role: Role.DRIVER,
      phone: "+91 90000 00003",
      organization: "Green Corridor Logistics",
    },
  });

  const factoryUser = await prisma.user.create({
    data: {
      email: "factory@apexrecycling.com",
      passwordHash,
      fullName: "Ananya Deshmukh (Receiving Weighmaster)",
      role: Role.FACTORY,
      phone: "+91 90000 00004",
      organization: "Apex E-Waste Disassembly & Smelting Hub",
      facilityId: facilityApex.id,
    },
  });

  const workerUser = await prisma.user.create({
    data: {
      email: "worker@apexrecycling.com",
      passwordHash,
      fullName: "Suresh Patil (Recovery Specialist)",
      role: Role.WORKER,
      phone: "+91 90000 00005",
      organization: "Apex E-Waste Disassembly & Smelting Hub",
      facilityId: facilityApex.id,
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      email: "customer@ecotrace.org",
      passwordHash,
      fullName: "Priya Sharma (Green Buyer)",
      role: Role.CUSTOMER,
      phone: "+91 90000 00006",
      organization: "Individual Consumer",
    },
  });

  // 3. Create Waste Categories
  const catPCB = await prisma.wasteCategory.create({
    data: {
      name: "Printed Circuit Boards (PCBs & Motherboards)",
      code: "PCB",
      description: "High precious-metal content circuitry from servers and PCs",
    },
  });

  const catBAT = await prisma.wasteCategory.create({
    data: {
      name: "Lithium-Ion & Secondary Batteries",
      code: "BAT",
      description: "Rechargeable batteries containing cobalt, lithium, and nickel",
    },
  });

  const catITC = await prisma.wasteCategory.create({
    data: {
      name: "IT & Computing Equipment",
      code: "ITC",
      description: "Laptops, workstations, server chassis, and networking switches",
    },
  });

  // 4. Create Initial Batches
  const batch1 = await prisma.wasteBatch.create({
    data: {
      batchId: "BATCH-2026-001",
      dealerId: dealerUser.id,
      categoryId: catPCB.id,
      pickupLocation: "Electronic City Depot 4, Bengaluru",
      sourceType: "Enterprise IT Decommission",
      description: "High-grade telecom and datacenter server motherboards",
      initialWeightKg: 100.0,
      status: BatchStatus.PROCESSED,
      destinationFacilityId: facilityApex.id,
      evidenceHash: sha256("weighing_receipt_BATCH-2026-001"),
      weighingSlipUrl: "/uploads/slips/slip-001.pdf",
      qrCodeData: JSON.stringify({ batchId: "BATCH-2026-001", initialWeightKg: 100.0 }),
      txHash: "0x4a7e91f092384918230918203918203918239018239018239018230918230918",
    },
  });

  const batch2 = await prisma.wasteBatch.create({
    data: {
      batchId: "BATCH-2026-002",
      dealerId: dealerUser.id,
      categoryId: catBAT.id,
      pickupLocation: "Whitefield Tech Park, Bengaluru",
      sourceType: "Commercial E-Vehicle Fleet",
      description: "EV battery modules and power storage units",
      initialWeightKg: 250.0,
      status: BatchStatus.DISPATCHED,
      destinationFacilityId: facilityWest.id,
      evidenceHash: sha256("weighing_receipt_BATCH-2026-002"),
      weighingSlipUrl: "/uploads/slips/slip-002.pdf",
      qrCodeData: JSON.stringify({ batchId: "BATCH-2026-002", initialWeightKg: 250.0 }),
    },
  });

  const batch3 = await prisma.wasteBatch.create({
    data: {
      batchId: "BATCH-2026-003",
      dealerId: dealerUser.id,
      categoryId: catITC.id,
      pickupLocation: "Koramangala Commercial Hub, Bengaluru",
      sourceType: "Corporate Office Tech Refresh",
      description: "High-end corporate laptops (Dell Latitude / ThinkPad series)",
      initialWeightKg: 80.0,
      status: BatchStatus.RECEIVED,
      destinationFacilityId: facilityApex.id,
      evidenceHash: sha256("weighing_receipt_BATCH-2026-003"),
      qrCodeData: JSON.stringify({ batchId: "BATCH-2026-003", initialWeightKg: 80.0 }),
    },
  });

  // 5. Create Dispatches
  const dispatch1 = await prisma.dispatch.create({
    data: {
      dispatchId: "DISP-2026-001",
      driverId: driverUser.id,
      vehicleRegistration: "KA-01-EQ-9988",
      pickupAddress: "Electronic City Depot 4, Bengaluru",
      destinationFacilityId: facilityApex.id,
      dispatchedWeightKg: 100.0,
      receivedWeightKg: 100.0,
      status: DispatchStatus.RECEIVED,
      pickupProofHash: sha256("pickup_proof_DISP-2026-001"),
      deliveryProofHash: sha256("delivery_proof_DISP-2026-001"),
      pickupTime: new Date(Date.now() - 86400000 * 2),
      deliveryTime: new Date(Date.now() - 86400000 * 1),
    },
  });

  await prisma.dispatchBatch.create({
    data: {
      dispatchId: dispatch1.id,
      batchId: batch1.id,
    },
  });

  const dispatch2 = await prisma.dispatch.create({
    data: {
      dispatchId: "DISP-2026-002",
      driverId: driverUser.id,
      vehicleRegistration: "KA-01-EQ-9988",
      pickupAddress: "Whitefield Tech Park, Bengaluru",
      destinationFacilityId: facilityWest.id,
      dispatchedWeightKg: 250.0,
      status: DispatchStatus.IN_TRANSIT,
      pickupProofHash: sha256("pickup_proof_DISP-2026-002"),
      pickupTime: new Date(Date.now() - 3600000 * 4),
    },
  });

  await prisma.dispatchBatch.create({
    data: {
      dispatchId: dispatch2.id,
      batchId: batch2.id,
    },
  });

  // 6. Create Receiving Record
  const receivingRecord1 = await prisma.receivingRecord.create({
    data: {
      batchId: batch1.id,
      dispatchId: dispatch1.id,
      facilityId: facilityApex.id,
      receiverUserId: factoryUser.id,
      measuredWeightKg: 100.0,
      acceptedWeightKg: 100.0,
      rejectedWeightKg: 0.0,
      isDisputed: false,
      inspectionNotes: "Intact packaging, verified seals, zero transit tampering.",
      storageLocation: "Bay-A-Shelves-12",
      evidenceHash: sha256("weighbridge_cert_DISP-001"),
    },
  });

  // 7. Create Processing Record (Strict Mass Balance Reconciled)
  // Input: 100kg = Recovered (20kg Copper + 15kg Aluminum + 40kg Plastic = 75kg) + Residual (20kg) + Loss (5kg) = 100kg
  const proc1 = await prisma.processingRecord.create({
    data: {
      processingId: "PROC-2026-001",
      sourceBatchId: batch1.id,
      facilityId: facilityApex.id,
      workerUserId: workerUser.id,
      supervisorUserId: adminUser.id,
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
  });

  // 8. Create Recovered Materials
  const matCopper = await prisma.recoveredMaterial.create({
    data: {
      materialBatchId: "MAT-COPPER-001",
      sourceBatchId: batch1.id,
      processingRecordId: proc1.id,
      materialType: "Electrolytic Copper Cathode",
      recoveredWeightKg: 20.0,
      claimedWeightKg: 12.0, // 8.0 kg remaining claimable
      purityPercentage: 99.85,
      location: "Warehouse Smelter Vault 1",
      evidenceHash: sha256("spectroscopy_report_MAT-COPPER-001"),
    },
  });

  const matAluminum = await prisma.recoveredMaterial.create({
    data: {
      materialBatchId: "MAT-ALUM-001",
      sourceBatchId: batch1.id,
      processingRecordId: proc1.id,
      materialType: "Aerospace-Grade Aluminum Scrap",
      recoveredWeightKg: 15.0,
      claimedWeightKg: 0.0,
      purityPercentage: 98.5,
      location: "Warehouse Bay 3",
      evidenceHash: sha256("assay_report_MAT-ALUM-001"),
    },
  });

  const matPlastic = await prisma.recoveredMaterial.create({
    data: {
      materialBatchId: "MAT-PLASTIC-001",
      sourceBatchId: batch1.id,
      processingRecordId: proc1.id,
      materialType: "Engineering Grade ABS Pellets",
      recoveredWeightKg: 40.0,
      claimedWeightKg: 0.0,
      purityPercentage: 95.0,
      location: "Silo 4",
      evidenceHash: sha256("polymer_test_MAT-PLASTIC-001"),
    },
  });

  // 9. Create Recovery Claims & Duplicate Prevention Log
  await prisma.recoveryClaim.create({
    data: {
      claimId: "CLAIM-2026-001",
      materialBatchId: matCopper.id,
      claimantName: "GreenTech Cables & Wires Ltd",
      claimantOrg: "GreenTech Industrial Group",
      claimedWeightKg: 12.0,
      verified: true,
      notes: "Audited circular economy material claim for eco-line ethernet cables.",
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    },
  });

  // 10. Create Refurbished Product with Provenance
  const product1 = await prisma.product.create({
    data: {
      productId: "PROD-REFURB-001",
      serialNumber: "SN-DELL-883921",
      name: "Dell Latitude 7420 Enterprise Laptop (Eco-Certified)",
      brandModel: "Dell Latitude 7420",
      sourceBatchId: batch1.id,
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
  });

  await prisma.productServiceRecord.create({
    data: {
      productId: product1.id,
      serviceType: "BATTERY_REPLACEMENT",
      description: "Original degraded cell replaced with certified high-efficiency lithium module.",
      technicianName: "Suresh Patil",
    },
  });

  await prisma.ownershipEvent.create({
    data: {
      productId: product1.id,
      eventType: "REGISTERED",
      description: "Certified refurbished product entered circular economy distribution registry.",
    },
  });

  // 11. Initial Audit Logs
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: "PLATFORM_INITIALIZED",
      entityType: "SYSTEM",
      entityId: "SYS-INIT",
      detailsJson: JSON.stringify({ message: "EcoTrace WEB3-02 Platform configured and seeded." }),
      ipAddress: "127.0.0.1",
    },
  });

  console.log("Database seeded successfully with 6 role test accounts and full lifecycle records!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
