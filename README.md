# EcoTrace — Blockchain-Powered E-Waste Lifecycle, Recovery & Audit Platform
**Hackathon Track**: Web3 and Blockchain  
**Problem Statement**: `WEB3-02 — E-Waste Collection, Recovery Yields and Auditable Material Claims`  
**Target Environment**: Kali Linux Rolling (2026.3) / Antigravity IDE

---

## 1. Executive Summary

**EcoTrace** is an enterprise-grade, cryptographically auditable circular economy platform designed to solve the critical challenges of e-waste traceability, mass-balance reconciliation, duplicate recovery claim prevention, and certified product provenance.

From informal scrap dealers and licensed aggregators through logistics, factory weighbridges, high-temperature recovery smelting, and circular refurbished electronics, EcoTrace enforces the physical law of mass conservation:

$$\sum \text{Input Waste (kg)} = \sum \text{Recovered Output (kg)} + \text{Residual Waste (kg)} + \text{Documented Process Loss (kg)}$$

Every critical transition is recorded on a local Ethereum-compatible blockchain (`EWasteRegistry.sol`) on Chain ID 31337, backed by SHA-256 evidence digests and verifiable by public consumers via QR codes.

---

## 2. Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Recharts, QR Code generator.
- **Backend**: Node.js 24, Express.js, TypeScript, Prisma ORM, PostgreSQL 18, Ethers.js v6, Zod, bcrypt, JWT, Multer.
- **Blockchain**: Solidity 0.8.24, Hardhat, Local EVM Node (Chain ID: 31337), Automated Mocha/Chai Unit Tests.
- **Database**: PostgreSQL 18.6 running natively in user-space on port 5432.
- **Integrity**: SHA-256 cryptographic digests on all weighing receipts, manifests, and inspection reports.

---

## 3. Six Role-Specific Portals

EcoTrace features six segregated login portals with tailored navigation, permitted actions, and strict server-side authorization:

| Role | Login Route | Dashboard Route | Test Account | Password |
|------|-------------|-----------------|--------------|----------|
| **Admin** | `/login/admin` | `/admin/dashboard` | `admin@ecotrace.org` | `password123` |
| **Dealer** | `/login/dealer` | `/dealer/dashboard` | `dealer@metrocollect.com` | `password123` |
| **Driver** | `/login/driver` | `/driver/dashboard` | `driver@greenlogistics.com` | `password123` |
| **Factory** | `/login/factory` | `/factory/dashboard` | `factory@apexrecycling.com` | `password123` |
| **Worker** | `/login/worker` | `/worker/dashboard` | `worker@apexrecycling.com` | `password123` |
| **Customer** | `/login/customer` | `/customer/dashboard` | `customer@ecotrace.org` | `password123` |
| **Public** | `/verify` | Public Verification | *No Login Required* | *N/A* |

---

## 4. Quick Start Guide (Kali Linux)

### Option A: One-Command Start All Services
Run the automated orchestration script from the repository root:
```bash
./scripts/start-all.sh
```
This automatically starts:
1. PostgreSQL 18 cluster on `localhost:5432`
2. Hardhat Local EVM Node on `http://127.0.0.1:8545`
3. Smart contract deployment of `EWasteRegistry.sol`
4. Express REST API on `http://localhost:5000`
5. Vite Web Application on `http://localhost:5173`

### Option B: Manual Step-by-Step Start

#### 1. Start Database & Seed
```bash
./scripts/start-db.sh
cd backend
npx prisma db push
npx ts-node prisma/seed.ts
```

#### 2. Start Blockchain & Deploy Contract
```bash
cd blockchain
npx hardhat node &
npx hardhat run scripts/deploy.ts --network localhost
```

#### 3. Start Backend API
```bash
cd backend
npx ts-node src/server.ts
```

#### 4. Start Frontend
```bash
cd frontend
npm run dev
```

---

## 5. Verified Automated Test Results

### 1. Smart Contract Unit Tests (`blockchain/test/EWasteRegistry.test.ts`)
Run: `cd blockchain && npx hardhat test`
```
  EWasteRegistry Smart Contract
    1. Batch Registration
      ✔ should allow a dealer to register an e-waste batch
      ✔ should reject duplicate batch IDs
    2. Dispatch and Handover Workflow
      ✔ should create dispatch and update batch status to Dispatched
      ✔ should flag receiving discrepancy when received weight differs
    3. Mass-Balance Validation
      ✔ should accept processing record when mass balance reconciles exactly
      ✔ should reject processing record when mass balance fails (unaccounted material)
    4. Duplicate Recovery-Claim Prevention
      ✔ should approve valid claim within available recovered weight
      ✔ should reject claim that exceeds remaining verified material
      ✔ should reject duplicate claim IDs
    5. Refurbished Product Provenance & Verification
      ✔ should register refurbished product and allow lookup by ID and serial number
      ✔ should revert on non-existent product verification

  11 passing (550ms)
```

### 2. Backend End-to-End Test Suite (`backend/src/test-e2e.ts`)
Run: `cd backend && npx ts-node src/test-e2e.ts`
```
=== ECOTRACE END-TO-END AUTOMATED VERIFICATION ===
[1] Health Check: PASS
[2] Login ADMIN (admin@ecotrace.org): PASS
[2] Login DEALER (dealer@metrocollect.com): PASS
[2] Login DRIVER (driver@greenlogistics.com): PASS
[2] Login FACTORY (factory@apexrecycling.com): PASS
[2] Login WORKER (worker@apexrecycling.com): PASS
[2] Login CUSTOMER (customer@ecotrace.org): PASS
[3] Portal Role Mismatch Protection: PASS (Blocked)
[4] Dealer Batch Registration: PASS (BATCH-2026-0004)
[5] Processing & Mass Balance Reconciliation: PASS (Yield: 75%)
[6] Negative Test - Mass Balance Mismatch Rejection: PASS (Rejected unbalanced record)
[7] Negative Test - Duplicate/Excessive Claim Rejection: PASS (Blocked double-claim)
[8] Public Verification by Product ID: PASS (Dell Latitude 7420 Enterprise Laptop)
[9] Public Verification by Serial Number: PASS (Grade A - Certified Pristine)
[10] Admin Live Metrics Aggregation: PASS (Real database records)
=== ALL END-TO-END BACKEND INTEGRATION TESTS COMPLETED ===
```

### 3. Frontend Production Build
Run: `cd frontend && npm run build`
```
✓ built in 2.82s (dist/index.html, dist/assets/index.js, dist/assets/index.css)
```

---

## 6. Project File Layout

```
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # Relational models with 22 tables & enums
│   │   └── seed.ts                  # Seed script with 6 role test accounts
│   ├── src/
│   │   ├── middleware/              # Auth & Role verification (JWT / bcrypt)
│   │   ├── routes/                  # 9 router modules (Auth, Batches, Dispatches, ...)
│   │   ├── services/                # Blockchain (ethers.js) & Audit loggers
│   │   ├── utils/                   # Mass-balance engine & SHA-256 hashers
│   │   ├── server.ts                # Express server entrypoint
│   │   └── test-e2e.ts              # Automated end-to-end integration tests
│   ├── package.json
│   └── tsconfig.json
├── blockchain/
│   ├── contracts/
│   │   └── EWasteRegistry.sol       # Solidity 0.8.24 core smart contract
│   ├── scripts/
│   │   └── deploy.ts                # Deployment script targeting Hardhat EVM
│   ├── test/
│   │   └── EWasteRegistry.test.ts   # 11 automated unit tests
│   ├── hardhat.config.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/layout/       # Navbar & RoleSidebar with Quick Role Switcher
│   │   ├── components/ui/           # StatCard, Badge, MassBalanceCalculator
│   │   ├── context/                 # AuthContext
│   │   ├── pages/                   # Landing, PublicVerify, and 6 Role Dashboards
│   │   ├── services/api.ts          # Central typed API client
│   │   ├── App.tsx                  # Protected routing tree
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docs/
│   ├── environment-setup.md         # Kali Linux environment inspection & setup
│   ├── architecture.md              # System architecture & Mermaid sequence flows
│   ├── api-documentation.md         # REST API reference
│   └── demo-instructions.md         # Step-by-step hackathon demo instructions
├── scripts/
│   ├── start-all.sh                 # Master startup script
│   └── start-db.sh                  # Local PostgreSQL 18 user-space launcher
├── README.md
└── .env.example
```

---

## 7. Security & Compliance Implementation

1. **Authentication & Authorization**: Passwords hashed with bcrypt (salt rounds: 10), short-lived JWT tokens, role-matching checks enforced in backend routes.
2. **Double-Count Prevention**: Smart contracts enforce `claimedWeight <= recoveredWeight - alreadyClaimed`, preventing duplicate claims.
3. **Audit Trail**: Every critical action creates an immutable database record in `AuditLog` and emits a Solidity event on Hardhat EVM.
4. **Data Privacy**: The public product verification portal strictly excludes personal identifiers, previous owners, phone numbers, or private factory invoices.
