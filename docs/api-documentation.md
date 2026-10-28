# EcoTrace REST API Documentation
**Base URL**: `http://localhost:5000/api`

---

## 1. Authentication (`/auth`)

### POST `/auth/login`
Authenticates a user for a specific portal or general access.
- **Body**:
  ```json
  {
    "email": "admin@ecotrace.org",
    "password": "password123",
    "portalRole": "ADMIN" // optional role enforcement
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "email": "admin@ecotrace.org",
      "fullName": "Dr. Ronald Vance",
      "role": "ADMIN"
    }
  }
  ```

### GET `/auth/me`
Retrieves current profile from Bearer JWT.
- **Headers**: `Authorization: Bearer <token>`

---

## 2. Batch Management (`/batches`)

### GET `/batches`
Lists batches with optional filtering.
- **Query Params**: `status`, `categoryId`, `facilityId`
- **Headers**: `Authorization: Bearer <token>`

### POST `/batches`
Registers a new e-waste batch (Dealer / Admin only). Automatically generates human-readable ID, mints QR code data, and writes to `EWasteRegistry.sol`.
- **Body**:
  ```json
  {
    "categoryId": "uuid",
    "destinationFacilityId": "uuid",
    "pickupLocation": "Electronic City Depot 4, Bengaluru",
    "sourceType": "Enterprise IT Decommission",
    "description": "Motherboard circuits and telecom hardware",
    "initialWeightKg": 150.0,
    "evidenceHash": "0xabc..." // optional SHA-256
  }
  ```

### GET `/batches/:batchId`
Retrieves comprehensive provenance timeline including dispatches, weighbridge receiving, processing, and refurbished devices.

---

## 3. Dispatches & Logistics (`/dispatches`)

### POST `/dispatches`
Creates a dispatch and assigns a driver.
- **Body**:
  ```json
  {
    "batchIds": ["uuid"],
    "driverId": "uuid",
    "vehicleRegistration": "KA-01-EQ-9988",
    "pickupAddress": "Electronic City Depot 4",
    "destinationFacilityId": "uuid"
  }
  ```

### PATCH `/dispatches/:id/status`
Advances trip status (`ASSIGNED` -> `PICKED_UP` -> `IN_TRANSIT` -> `DELIVERED`).
- **Body**:
  ```json
  {
    "status": "IN_TRANSIT",
    "discrepancyNotes": "Heavy rain delay logged at toll plaza."
  }
  ```

---

## 4. Factory Receiving & Weighing (`/receiving`)

### POST `/receiving/confirm`
Records weighbridge intake and flags discrepancies if measured differs from dispatched mass.
- **Body**:
  ```json
  {
    "dispatchId": "uuid",
    "measuredWeightKg": 148.5,
    "acceptedWeightKg": 148.5,
    "rejectedWeightKg": 0,
    "discrepancyReason": "1.5kg loss due to packaging moisture loss",
    "storageLocation": "Bay-A-Shelves-04",
    "isDisputed": false
  }
  ```

---

## 5. Recycling & Mass Balance (`/processing`)

### POST `/processing`
Records recycling run, validates physical mass balance conservation equation, and mints recovered material lots on-chain.
- **Body**:
  ```json
  {
    "sourceBatchId": "uuid",
    "inputWeightKg": 100.0,
    "materials": [
      {
        "materialType": "Electrolytic Copper Cathode",
        "weightKg": 40.0,
        "purityPercentage": 99.8,
        "location": "Vault 1"
      },
      {
        "materialType": "Recycled Aluminum Scrap",
        "weightKg": 35.0,
        "purityPercentage": 98.5,
        "location": "Bay 3"
      }
    ],
    "residualKg": 20.0,
    "documentedLossKg": 5.0
  }
  ```
- **Error (422)**: Returned if `inputWeightKg != sum(materials) + residualKg + documentedLossKg`.

---

## 6. Materials & Duplicate Claim Prevention (`/materials`)

### POST `/materials/claim`
Claims verified recovered material. Reverts with HTTP 400 if requested weight exceeds unallocated balance or is a duplicate.
- **Body**:
  ```json
  {
    "materialBatchId": "uuid",
    "claimedWeightKg": 15.0,
    "claimantName": "GreenTech Wires Ltd",
    "claimantOrg": "GreenTech Industrial Group",
    "notes": "Circular economy verified supply claim"
  }
  ```

---

## 7. Product Provenance & Public Verification (`/products`)

### GET `/products/verify/:query` (PUBLIC)
Public endpoint. No authentication required. Checks Product ID or Serial Number.
- **Example**: `GET /products/verify/SN-DELL-883921`
- **Response (200)**:
  ```json
  {
    "success": true,
    "status": "VERIFIED",
    "product": {
      "productId": "PROD-REFURB-001",
      "serialNumber": "SN-DELL-883921",
      "name": "Dell Latitude 7420 Enterprise Laptop",
      "condition": "Grade A - Certified Pristine",
      "warrantyMonths": 12,
      "replacedComponents": "New OEM Battery, 512GB SSD",
      "txHash": "0xfeeedd...",
      "blockchainProof": {
        "verifiedOnChain": true
      }
    }
  }
  ```

---

## 8. Admin Oversight & Analytics (`/admin`)

### GET `/admin/analytics`
Returns live calculated database statistics (no hardcoded fake values).

### GET `/admin/blockchain/txs`
Returns on-chain transactions committed to `EWasteRegistry.sol`.

### GET `/admin/export/csv`
Downloads full audit trail as a structured CSV file.
