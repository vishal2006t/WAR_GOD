import { expect } from "chai";
import { ethers } from "hardhat";
import { EWasteRegistry } from "../typechain-types";

describe("EWasteRegistry Smart Contract", function () {
  let registry: EWasteRegistry;
  let admin: any;
  let dealer: any;
  let driver: any;
  let worker: any;
  let customer: any;

  beforeEach(async function () {
    [admin, dealer, driver, worker, customer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("EWasteRegistry");
    registry = (await Factory.deploy()) as unknown as EWasteRegistry;
    await registry.waitForDeployment();
  });

  describe("1. Batch Registration", function () {
    it("should allow a dealer to register an e-waste batch", async function () {
      const tx = await registry.connect(dealer).registerBatch(
        "BATCH-2026-001",
        "Printed Circuit Boards (PCBs)",
        100000, // 100 kg in grams
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "FACILITY-CENTRAL"
      );
      await tx.wait();

      const batch = await registry.getBatch("BATCH-2026-001");
      expect(batch.batchId).to.equal("BATCH-2026-001");
      expect(batch.weightGrams).to.equal(100000n);
      expect(batch.registeredBy).to.equal(dealer.address);
      expect(batch.status).to.equal(0n); // Registered
    });

    it("should reject duplicate batch IDs", async function () {
      await registry.connect(dealer).registerBatch(
        "BATCH-DUP-01",
        "Batteries",
        50000,
        "0x1111",
        "FACILITY-1"
      );

      await expect(
        registry.connect(dealer).registerBatch(
          "BATCH-DUP-01",
          "Batteries",
          50000,
          "0x1111",
          "FACILITY-1"
        )
      ).to.be.revertedWithCustomError(registry, "BatchAlreadyExists");
    });
  });

  describe("2. Dispatch and Handover Workflow", function () {
    beforeEach(async function () {
      await registry.connect(dealer).registerBatch(
        "BATCH-TR-01",
        "Consumer Electronics",
        80000,
        "0xhash01",
        "FACILITY-RECYCLE-A"
      );
    });

    it("should create dispatch and update batch status to Dispatched", async function () {
      await registry.createDispatch(
        "DISPATCH-101",
        ["BATCH-TR-01"],
        driver.address,
        "KA-01-EQ-9988",
        80000,
        "0xpickuphash"
      );

      const d = await registry.getDispatch("DISPATCH-101");
      expect(d.driver).to.equal(driver.address);
      expect(d.dispatchedWeightGrams).to.equal(80000n);

      const batch = await registry.getBatch("BATCH-TR-01");
      expect(batch.status).to.equal(1n); // Dispatched
    });

    it("should flag receiving discrepancy when received weight differs", async function () {
      await registry.createDispatch(
        "DISPATCH-102",
        ["BATCH-TR-01"],
        driver.address,
        "KA-01-EQ-9988",
        80000,
        "0xpickuphash"
      );

      // Received 75kg instead of 80kg -> Disputed!
      await registry.recordReceiving("DISPATCH-102", 75000, "0xdeliveryhash", false);

      const d = await registry.getDispatch("DISPATCH-102");
      expect(d.isDelivered).to.be.true;
      expect(d.isDisputed).to.be.true;

      const batch = await registry.getBatch("BATCH-TR-01");
      expect(batch.status).to.equal(4n); // Disputed
    });
  });

  describe("3. Mass-Balance Validation", function () {
    beforeEach(async function () {
      await registry.connect(dealer).registerBatch(
        "BATCH-REC-100",
        "Server Racks & Motherboards",
        100000, // 100 kg
        "0xbatchhash",
        "FAC-WEST"
      );
    });

    it("should accept processing record when mass balance reconciles exactly", async function () {
      // 100kg input = 40kg copper + 35kg aluminum + 20kg residual + 5kg loss = 100kg
      const tx = await registry.connect(worker).recordProcessing(
        "PROC-2026-01",
        "BATCH-REC-100",
        100000,
        75000, // 40k + 35k recovered
        20000, // residual
        5000,  // documented loss
        "0xprocevidence"
      );
      await tx.wait();

      const proc = await registry.getProcessing("PROC-2026-01");
      expect(proc.massBalanceValid).to.be.true;
      expect(proc.totalRecoveredGrams).to.equal(75000n);

      const b = await registry.getBatch("BATCH-REC-100");
      expect(b.status).to.equal(3n); // Processed
    });

    it("should reject processing record when mass balance fails (unaccounted material)", async function () {
      // 100kg input != 75kg + 10kg + 5kg (sum is 90kg, 10kg missing!)
      await expect(
        registry.connect(worker).recordProcessing(
          "PROC-INVALID",
          "BATCH-REC-100",
          100000,
          75000,
          10000,
          5000,
          "0xprocevidence"
        )
      ).to.be.revertedWithCustomError(registry, "MassBalanceMismatch");
    });
  });

  describe("4. Duplicate Recovery-Claim Prevention", function () {
    beforeEach(async function () {
      await registry.connect(worker).registerRecoveredMaterial(
        "MAT-COPPER-99",
        "BATCH-REC-100",
        "Refined Copper Cathode",
        50000, // 50 kg available
        "0xcopperevidence"
      );
    });

    it("should approve valid claim within available recovered weight", async function () {
      await registry.claimRecoveredMaterial(
        "CLAIM-001",
        "MAT-COPPER-99",
        30000, // claim 30 kg
        "GreenTech Cables Ltd"
      );

      const mat = await registry.getMaterialBatch("MAT-COPPER-99");
      expect(mat.claimedWeightGrams).to.equal(30000n);
    });

    it("should reject claim that exceeds remaining verified material", async function () {
      // Claim 30kg first
      await registry.claimRecoveredMaterial(
        "CLAIM-001",
        "MAT-COPPER-99",
        30000,
        "Claimant A"
      );

      // Attempt to claim 25kg (30 + 25 = 55kg > 50kg!) -> Reverts!
      await expect(
        registry.claimRecoveredMaterial(
          "CLAIM-002",
          "MAT-COPPER-99",
          25000,
          "Claimant B"
        )
      ).to.be.revertedWithCustomError(registry, "ClaimExceedsAvailableWeight");
    });

    it("should reject duplicate claim IDs", async function () {
      await registry.claimRecoveredMaterial(
        "CLAIM-DUP",
        "MAT-COPPER-99",
        10000,
        "Claimant A"
      );

      await expect(
        registry.claimRecoveredMaterial(
          "CLAIM-DUP",
          "MAT-COPPER-99",
          10000,
          "Claimant B"
        )
      ).to.be.revertedWithCustomError(registry, "DuplicateClaimId");
    });
  });

  describe("5. Refurbished Product Provenance & Verification", function () {
    it("should register refurbished product and allow lookup by ID and serial number", async function () {
      await registry.registerRefurbishedProduct(
        "PROD-LAPTOP-77",
        "SN-DELL-883921",
        "BATCH-REC-100",
        "Grade A - Certified Refurbished",
        "0xinspectionreport123"
      );

      const prodById = await registry.verifyProduct("PROD-LAPTOP-77");
      expect(prodById.serialNumber).to.equal("SN-DELL-883921");
      expect(prodById.condition).to.equal("Grade A - Certified Refurbished");

      const prodBySerial = await registry.verifyBySerial("SN-DELL-883921");
      expect(prodBySerial.productId).to.equal("PROD-LAPTOP-77");
    });

    it("should revert on non-existent product verification", async function () {
      await expect(
        registry.verifyProduct("NON-EXISTENT")
      ).to.be.revertedWithCustomError(registry, "ProductNotFound");
    });
  });
});
