# EcoTrace 36-Hour Hackathon Demo & Walkthrough Guide
**Problem Statement**: WEB3-02 — E-Waste Lifecycle, Recovery and Audit Platform

---

## 1. Quick Test Credentials

All accounts are pre-seeded with password: `password123`. Each portal has an **Auto Fill** button for instant 1-click access.

| Role | Portal URL | Seeded Email | Default Password | Primary Responsibility |
|------|------------|--------------|------------------|------------------------|
| **Admin** | `http://localhost:5173/login/admin` | `admin@ecotrace.org` | `password123` | National audit tower, analytics, duplicate claims, CSV export |
| **Dealer** | `http://localhost:5173/login/dealer` | `dealer@metrocollect.com` | `password123` | Batch intake, QR generation, transport dispatch |
| **Driver** | `http://localhost:5173/login/driver` | `driver@greenlogistics.com` | `password123` | Vehicle manifest, transit status (`Picked Up` -> `Delivered`) |
| **Factory** | `http://localhost:5173/login/factory` | `factory@apexrecycling.com` | `password123` | Weighbridge measurement, discrepancy dispute flags |
| **Worker** | `http://localhost:5173/login/worker` | `worker@apexrecycling.com` | `password123` | Mass-balance calculator, recycling run, refurbished goods |
| **Customer** | `http://localhost:5173/login/customer` | `customer@ecotrace.org` | `password123` | Catalog provenance check, warranty verification |

---

## 2. Recommended 5-Minute Hackathon Demonstration Flow

### Step 1: Public Customer Provenance Verifier (Zero Login Required)
1. Open `http://localhost:5173/` (Landing Page).
2. Click the demo serial link `SN-DELL-883921` or type it into the search box and click **Verify**.
3. Point out:
   - **Verification Status**: `VERIFIED` with green badge.
   - **Hardware Specifications**: Dell Latitude 7420, Grade A condition.
   - **Replaced Components**: New 68Wh Battery, Arctic Silver Thermal Repaste, Micron 512GB NVMe SSD.
   - **Material Origin**: Source Batch `BATCH-2026-001` (Printed Circuit Boards).
   - **Blockchain Proof**: Real transaction hash and SHA-256 inspection digest recorded on Hardhat EVM (31337).

### Step 2: Admin Regulatory & Oversight Tower
1. Navigate to `http://localhost:5173/login/admin`, click **Auto Fill**, then click **Sign In**.
2. Review the live metrics: Total Collected Weight (kg), Overall Recovery Yield (%), Duplicate Claim Alerts, Disputed Shipments.
3. Show the **Mass-Balance Breakdown** and **Recovered vs Claimed Materials** interactive charts.
4. Click the **Export Audit CSV** button to download a live CSV report generated from database records.
5. Click the **Blockchain Ledger** tab to show immutable transactions on the local EVM node.

### Step 3: Dealer Collection & QR Manifest Generation
1. Click the **Switch Role** dropdown in the top navbar and select **Collector / Dealer**.
2. Click **Register New E-Waste Batch**:
   - Category: `Lithium-Ion & Secondary Batteries`
   - Weight: `150 kg`
   - Destination: `Apex E-Waste Disassembly & Smelting Hub`
   - Click **Confirm & Register**.
3. Click the **QR Code** button on the newly created batch row to display the cryptographic batch label.

### Step 4: Factory Intake & Discrepancy Dispute Test
1. Click **Switch Role** -> **Factory Receiving**.
2. In the **Incoming Shipments Queue**, click **Weigh & Receive**.
3. Intentionally change **Actual Measured Weight** from `250 kg` to `245 kg` (5 kg loss).
4. Notice that the UI instantly flags: `Weight Discrepancy Detected (5.0 kg difference)` and requires a mandatory reason: `Tarp ripped during transit, loose cells dropped`.
5. Submit the form. The batch status immediately transitions to `DISPUTED` on both database and smart contract!

### Step 5: Worker Recycling & Strict Mass-Balance Engine
1. Click **Switch Role** -> **Recycling Worker**.
2. Observe the interactive **Mass-Balance Reconciliation Engine** widget.
3. Click **Record Recycling & Mass Balance**:
   - Feedstock Weight: `100 kg`
   - Output Fractions: `Copper (40kg)` + `Aluminum (35kg)` = `75kg`
   - Residual Waste: `20kg`
   - Documented Loss: `5kg`
   - Total: `40 + 35 + 20 + 5 = 100 kg` -> Reconciled (100% Balanced)!
4. Change Documented Loss to `0 kg` (Total is now 95kg != 100kg):
   - Notice the engine turns red: `Unbalanced (5.0 kg discrepancy)`.
   - Submitting unbalanced data triggers an HTTP 422 rejection, enforcing physical mass conservation!
5. Restore balance to 5 kg and submit to commit the run on-chain.

### Step 6: Duplicate Claim Prevention Demo
1. Run the automated negative test in a terminal:
   ```bash
   cd backend && npx ts-node src/test-e2e.ts
   ```
2. Point out negative test `[7] Negative Test - Duplicate/Excessive Claim Rejection: PASS (Blocked double-claim)` verifying that double-counting claims are rejected!
