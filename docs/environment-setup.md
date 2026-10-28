# EcoTrace — Environment Setup & Verification Guide
**Target System**: Kali Linux Rolling (2026.3 / x86_64)  
**Hackathon Problem Statement**: WEB3-02 — E-Waste Lifecycle, Recovery and Audit Platform

---

## 1. Environment Inspection Summary

| Component | Status | Detected Version / Details | Notes |
|-----------|--------|----------------------------|-------|
| **OS** | Verified | Kali GNU/Linux Rolling (Kernel 7.1.5+kali-amd64) | Tested on x86_64 architecture |
| **Node.js** | Verified | `v24.21.0` | Native Node LTS installed |
| **npm** | Verified | `12.0.2` | Native package manager installed |
| **Git** | Verified | `2.53.0` | Repository initialized |
| **Python** | Verified | `3.14.7` | Available |
| **PostgreSQL** | Verified | PostgreSQL 18.6 (`/usr/lib/postgresql/18/bin`) | User-space data cluster configured on port 5432 |
| **Local EVM** | Configured | Hardhat 2.22+ Local Node | Runs on port 8545 (Chain ID: 31337) |
| **Frontend Dev** | Configured | Vite + React + TypeScript + Tailwind CSS | Runs on port 5173 |
| **Backend API** | Configured | Express + TypeScript + Prisma ORM | Runs on port 5000 |

---

## 2. PostgreSQL Configuration (Zero-Root / User-Space)

Kali Linux provides PostgreSQL 18 binaries under `/usr/lib/postgresql/18/bin`. To allow smooth execution without requiring root/sudo privileges:
1. Data directory: `/home/vishal/Quant A maze/data/postgres`
2. Socket directory: `/tmp`
3. Port: `5432`
4. Database name: `ecotrace`
5. Connection URL: `postgresql://postgres@localhost:5432/ecotrace`

### Start Database Command
```bash
/usr/lib/postgresql/18/bin/pg_ctl -D "/home/vishal/Quant A maze/data/postgres" -l "/home/vishal/Quant A maze/data/postgres.log" start
```

### Stop Database Command
```bash
/usr/lib/postgresql/18/bin/pg_ctl -D "/home/vishal/Quant A maze/data/postgres" stop
```

### Check Database Status
```bash
/usr/lib/postgresql/18/bin/pg_isready -h localhost -p 5432
```

---

## 3. Blockchain Setup (Hardhat Local Node)

The blockchain component uses Hardhat with ethers.js:
- Contract: `contracts/EWasteRegistry.sol`
- Network: Localhost (`http://127.0.0.1:8545`)
- Chain ID: `31337`
- Solidity Version: `0.8.24`

### Compile Contracts
```bash
cd blockchain
npx hardhat compile
```

### Run Tests
```bash
cd blockchain
npx hardhat test
```

### Start Local Node
```bash
cd blockchain
npx hardhat node
```

### Deploy to Localhost
```bash
cd blockchain
npx hardhat run scripts/deploy.ts --network localhost
```

---

## 4. Backend Setup

- Location: `backend/`
- Runtime: Node.js 24 + TypeScript
- ORM: Prisma 6 / PostgreSQL
- Port: `5000`

### Commands
```bash
cd backend
npm install
npx prisma db push # or npx prisma migrate dev
npm run seed
npm run dev
```

---

## 5. Frontend Setup

- Location: `frontend/`
- Framework: React 18 / Vite / TypeScript / Tailwind CSS / Lucide React / Recharts
- Port: `5173`

### Commands
```bash
cd frontend
npm install
npm run dev
```

---

## 6. Verification Checklist

- [x] Node.js and npm verified
- [x] PostgreSQL 18 cluster created, started, and database `ecotrace` created
- [ ] Hardhat smart contracts compiled and unit tested
- [ ] Hardhat local EVM deployed with `EWasteRegistry` address exported
- [ ] Prisma schema migrated and populated with seed test data
- [ ] Backend Express API verified with all role endpoints
- [ ] Frontend Vite application verified with all 6 role portals and public verification
- [ ] End-to-end collection -> transit -> receiving -> recycling -> mass-balance -> customer verification flow verified
