import { ethers } from "ethers";
import { prisma } from "../utils/prisma";
import fs from "fs";
import path from "path";

let contractConfig: any = null;
try {
  const configPath = path.join(__dirname, "../blockchain/contract-config.json");
  if (fs.existsSync(configPath)) {
    contractConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (e) {
  console.warn("Could not load contract-config.json:", e);
}

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || (contractConfig ? contractConfig.address : "");

class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.provider = new ethers.JsonRpcProvider(RPC_URL);
      this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
      if (CONTRACT_ADDRESS && contractConfig?.abi) {
        this.contract = new ethers.Contract(CONTRACT_ADDRESS, contractConfig.abi, this.wallet);
      }
    } catch (err) {
      console.warn("BlockchainService initialization warning:", err);
    }
  }

  private txQueue: Promise<any> = Promise.resolve();

  private async executeTx(
    fnName: string,
    contractCall: (contract: ethers.Contract) => Promise<any>,
    payload: any
  ): Promise<string> {
    // Sequence transactions through queue to prevent nonce collision
    return new Promise<string>((resolve, reject) => {
      this.txQueue = this.txQueue.then(async () => {
        try {
          const res = await this.performTx(fnName, contractCall, payload);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private async performTx(
    fnName: string,
    contractCall: (contract: ethers.Contract) => Promise<any>,
    payload: any
  ): Promise<string> {
    if (!this.contract) {
      this.init();
    }

    if (this.contract) {
      try {
        const tx = await contractCall(this.contract);
        const receipt = await tx.wait();
        const txHash = receipt.hash || tx.hash;

        await prisma.blockchainTransaction.create({
          data: {
            txHash,
            functionName: fnName,
            contractAddress: CONTRACT_ADDRESS,
            fromAddress: this.wallet?.address,
            blockNumber: receipt.blockNumber,
            status: "CONFIRMED",
            payloadJson: JSON.stringify(payload),
          },
        });

        return txHash;
      } catch (err: any) {
        console.error(`Blockchain tx failed for ${fnName}:`, err.message);
        throw err;
      }
    }

    // Fallback if contract or node is offline
    const fallbackHash = "0x" + ethers.keccak256(ethers.toUtf8Bytes(fnName + Date.now())).slice(2);
    await prisma.blockchainTransaction.create({
      data: {
        txHash: fallbackHash,
        functionName: fnName,
        contractAddress: CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
        status: "LOCAL_DEV_OFFLINE",
        payloadJson: JSON.stringify(payload),
      },
    });
    return fallbackHash;
  }

  async recordBatch(
    batchId: string,
    category: string,
    weightKg: number,
    evidenceHash: string,
    destinationFacility: string
  ): Promise<string> {
    const weightGrams = BigInt(Math.round(weightKg * 1000));
    return this.executeTx(
      "registerBatch",
      (c) => c.registerBatch(batchId, category, weightGrams, evidenceHash || "0x00", destinationFacility),
      { batchId, category, weightKg, evidenceHash, destinationFacility }
    );
  }

  async recordDispatch(
    dispatchId: string,
    batchIds: string[],
    driverAddress: string,
    vehicleReg: string,
    dispatchedWeightKg: number,
    pickupProofHash: string
  ): Promise<string> {
    const weightGrams = BigInt(Math.round(dispatchedWeightKg * 1000));
    const safeDriver = ethers.isAddress(driverAddress) ? driverAddress : this.wallet?.address;
    return this.executeTx(
      "createDispatch",
      (c) => c.createDispatch(dispatchId, batchIds, safeDriver, vehicleReg, weightGrams, pickupProofHash || "0x00"),
      { dispatchId, batchIds, vehicleReg, dispatchedWeightKg }
    );
  }

  async recordReceiving(
    dispatchId: string,
    receivedWeightKg: number,
    deliveryProofHash: string,
    disputeWeight: boolean
  ): Promise<string> {
    const weightGrams = BigInt(Math.round(receivedWeightKg * 1000));
    return this.executeTx(
      "recordReceiving",
      (c) => c.recordReceiving(dispatchId, weightGrams, deliveryProofHash || "0x00", disputeWeight),
      { dispatchId, receivedWeightKg, disputeWeight }
    );
  }

  async recordProcessing(
    processingId: string,
    sourceBatchId: string,
    inputWeightKg: number,
    totalRecoveredKg: number,
    residualKg: number,
    documentedLossKg: number,
    evidenceHash: string
  ): Promise<string> {
    const inputGrams = BigInt(Math.round(inputWeightKg * 1000));
    const recoveredGrams = BigInt(Math.round(totalRecoveredKg * 1000));
    const residualGrams = BigInt(Math.round(residualKg * 1000));
    const lossGrams = BigInt(Math.round(documentedLossKg * 1000));

    return this.executeTx(
      "recordProcessing",
      (c) => c.recordProcessing(
        processingId,
        sourceBatchId,
        inputGrams,
        recoveredGrams,
        residualGrams,
        lossGrams,
        evidenceHash || "0x00"
      ),
      { processingId, sourceBatchId, inputWeightKg, totalRecoveredKg, residualKg, documentedLossKg }
    );
  }

  async registerRecoveredMaterial(
    materialBatchId: string,
    sourceBatchId: string,
    materialType: string,
    weightKg: number,
    evidenceHash: string
  ): Promise<string> {
    const weightGrams = BigInt(Math.round(weightKg * 1000));
    return this.executeTx(
      "registerRecoveredMaterial",
      (c) => c.registerRecoveredMaterial(materialBatchId, sourceBatchId, materialType, weightGrams, evidenceHash || "0x00"),
      { materialBatchId, sourceBatchId, materialType, weightKg }
    );
  }

  async claimRecoveredMaterial(
    claimId: string,
    materialBatchId: string,
    claimedWeightKg: number,
    claimant: string
  ): Promise<string> {
    const claimGrams = BigInt(Math.round(claimedWeightKg * 1000));
    return this.executeTx(
      "claimRecoveredMaterial",
      (c) => c.claimRecoveredMaterial(claimId, materialBatchId, claimGrams, claimant),
      { claimId, materialBatchId, claimedWeightKg, claimant }
    );
  }

  async registerRefurbishedProduct(
    productId: string,
    serialNumber: string,
    sourceBatchId: string,
    condition: string,
    inspectionHash: string
  ): Promise<string> {
    return this.executeTx(
      "registerRefurbishedProduct",
      (c) => c.registerRefurbishedProduct(
        productId,
        serialNumber || "",
        sourceBatchId || "",
        condition,
        inspectionHash || "0x00"
      ),
      { productId, serialNumber, sourceBatchId, condition }
    );
  }

  async verifyProduct(productId: string): Promise<any> {
    if (this.contract) {
      try {
        const res = await this.contract.verifyProduct(productId);
        return {
          productId: res.productId,
          serialNumber: res.serialNumber,
          sourceBatchId: res.sourceBatchId,
          condition: res.condition,
          inspectionHash: res.inspectionHash,
          refurbishmentTimestamp: Number(res.refurbishmentTimestamp),
          exists: res.exists,
        };
      } catch (e: any) {
        return null;
      }
    }
    return null;
  }
}

export const blockchainService = new BlockchainService();
