/**
 * EcoTrace — Admin User Management & Role-Based Access Control Audit Suite
 *
 * Automated verification of all 17 required scenarios:
 * 1. Admin can list and search users.
 * 2. Admin can create a valid worker account.
 * 3. Duplicate emails and IDs are rejected.
 * 4. Invalid roles are rejected.
 * 5. Admin can update permitted user fields.
 * 6. Admin can change roles with proper authorization.
 * 7. Admin can deactivate and reactivate users.
 * 8. Deactivated users cannot access protected APIs.
 * 9. Non-admin users cannot access management endpoints.
 * 10. Non-admin users cannot create Admin accounts.
 * 11. Users cannot elevate their own roles.
 * 12. The last active Admin cannot be removed.
 * 13. Historical records remain intact after account archival.
 * 14. Candidate/employee ID search returns the correct record.
 * 15. Audit logs contain correct action details.
 * 16. Validation errors return descriptive details.
 * 17. Existing login and role-based portals still work.
 */

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import {
  UserModel,
  Role,
  AccountStatus,
  AuditLogModel,
  DispatchModel,
  WasteBatchModel,
  DispatchStatus,
} from "./models";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "ecotrace-super-secure-hackathon-jwt-secret-2026";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${message}`);
  }
}

async function request(endpoint: string, options: any = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function runAudit() {
  console.log("=======================================================================");
  console.log("   ECOTRACE ADMIN USER MANAGEMENT & RBAC AUDIT SUITE");
  console.log("=======================================================================\n");

  await mongoose.connect(process.env.MONGODB_URI || "");
  console.log("[MongoDB] Connected successfully for user management test fixture.\n");

  // Step 0: Ensure token generation for test roles
  const adminUser = await UserModel.findOne({ role: Role.ADMIN, status: "APPROVED", isArchived: { $ne: true } }).lean();
  const workerUser = await UserModel.findOne({ role: Role.WORKER }).lean();
  const driverUser = await UserModel.findOne({ role: Role.DRIVER }).lean();
  const dealerUser = await UserModel.findOne({ role: Role.DEALER }).lean();
  const customerUser = await UserModel.findOne({ role: Role.CUSTOMER }).lean();

  if (!adminUser) throw new Error("Seed admin account missing!");

  const adminToken = jwt.sign(
    { id: (adminUser as any)._id.toString(), email: adminUser.email, fullName: adminUser.fullName, role: Role.ADMIN },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  const workerToken = jwt.sign(
    { id: (workerUser as any)._id.toString(), email: workerUser!.email, fullName: workerUser!.fullName, role: Role.WORKER },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  const dealerToken = jwt.sign(
    { id: (dealerUser as any)._id.toString(), email: dealerUser!.email, fullName: dealerUser!.fullName, role: Role.DEALER },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  const customerToken = jwt.sign(
    { id: (customerUser as any)._id.toString(), email: customerUser!.email, fullName: customerUser!.fullName, role: Role.CUSTOMER },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  let testWorkerId = "";
  const testWorkerEmail = `test.worker.${Date.now()}@ecotrace.org`;
  const testWorkerEmployeeId = `WRK-${Date.now().toString().slice(-6)}`;

  // -------------------------------------------------------------------------
  console.log("Scenario 1: Admin Can List and Search Users");
  // -------------------------------------------------------------------------
  {
    const res = await request("/api/admin/users?limit=5", { token: adminToken });
    assert(res.status === 200, "GET /api/admin/users returns HTTP 200");
    assert(res.data.success === true, "Response indicates success=true");
    assert(Array.isArray(res.data.users), "Response contains users array");
    assert(res.data.users.length > 0, `Returned ${res.data.users.length} users on page`);
    assert(res.data.total >= res.data.users.length, `Total user count is reported (${res.data.total})`);

    // Search by name
    const searchRes = await request(`/api/admin/users?search=${encodeURIComponent("Ronald Vance")}`, {
      token: adminToken,
    });
    assert(searchRes.status === 200, "Search by name returns HTTP 200");
    assert(
      searchRes.data.users.some((u: any) => u.email === adminUser.email),
      "Search results include the queried user"
    );

    // Filter by role
    const roleRes = await request("/api/admin/users?role=ADMIN", { token: adminToken });
    assert(roleRes.status === 200, "Filter by role returns HTTP 200");
    assert(
      roleRes.data.users.every((u: any) => u.role === "ADMIN"),
      "All returned users match the filtered role ADMIN"
    );
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 2: Admin Can Create a Valid Worker Account");
  // -------------------------------------------------------------------------
  {
    const payload = {
      fullName: "Arun Joshi (Recycling Worker)",
      email: testWorkerEmail,
      role: "WORKER",
      employeeId: testWorkerEmployeeId,
      password: "SecureWorkerPassword123!",
      phone: "+91 98450 12345",
      organization: "Apex E-Waste Recycling Hub",
      status: "APPROVED",
    };

    const res = await request("/api/admin/users", {
      method: "POST",
      token: adminToken,
      body: payload,
    });

    assert(res.status === 201, "POST /api/admin/users creates account with HTTP 201");
    assert(res.data.success === true, "User creation returns success=true");
    assert(res.data.user.email === testWorkerEmail.toLowerCase(), "Created user email matches request");
    assert(res.data.user.employeeId === testWorkerEmployeeId, "Employee ID stored correctly");
    assert(res.data.user.passwordHash === undefined, "Security: Password hash is not exposed in API response");
    testWorkerId = res.data.user.id;

    // Verify in MongoDB directly
    const userInDb = await UserModel.findById(testWorkerId).lean();
    assert(userInDb !== null, "User record is persisted in MongoDB");
    assert((userInDb as any).passwordHash !== undefined, "Password hash is safely stored in database");
    assert((userInDb as any).passwordHash !== "SecureWorkerPassword123!", "Password was properly hashed with bcrypt");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 3: Duplicate Emails and Employee IDs Are Rejected");
  // -------------------------------------------------------------------------
  {
    // Duplicate email
    const dupEmailRes = await request("/api/admin/users", {
      method: "POST",
      token: adminToken,
      body: {
        fullName: "Another Worker",
        email: testWorkerEmail,
        role: "WORKER",
        employeeId: `WRK-${Date.now().toString().slice(-5)}`,
      },
    });
    assert(dupEmailRes.status === 409, "Duplicate email rejected with HTTP 409 Conflict");
    assert(dupEmailRes.data.error.includes("already exists"), "Helpful duplicate email error message returned");

    // Duplicate employee ID
    const dupIdRes = await request("/api/admin/users", {
      method: "POST",
      token: adminToken,
      body: {
        fullName: "Third Worker",
        email: `unique.${Date.now()}@ecotrace.org`,
        role: "WORKER",
        employeeId: testWorkerEmployeeId,
      },
    });
    assert(dupIdRes.status === 409, "Duplicate Employee ID rejected with HTTP 409 Conflict");
    assert(dupIdRes.data.error.includes("already assigned"), "Helpful duplicate Employee ID error message returned");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 4: Invalid Roles Are Rejected");
  // -------------------------------------------------------------------------
  {
    const badRoleRes = await request("/api/admin/users", {
      method: "POST",
      token: adminToken,
      body: {
        fullName: "Hacker User",
        email: `hacker.${Date.now()}@ecotrace.org`,
        role: "SUPER_ROOT_ADMIN",
      },
    });
    assert(badRoleRes.status === 400, "Invalid role rejected with HTTP 400");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 5: Admin Can Update Permitted User Fields");
  // -------------------------------------------------------------------------
  {
    const updateRes = await request(`/api/admin/users/${testWorkerId}`, {
      method: "PATCH",
      token: adminToken,
      body: {
        fullName: "Arun Joshi (Senior Recycling Specialist)",
        phone: "+91 98450 99999",
        organization: "Apex Central Disassembly Yard",
      },
    });

    assert(updateRes.status === 200, "PATCH /api/admin/users/:id returns HTTP 200");
    assert(updateRes.data.user.fullName === "Arun Joshi (Senior Recycling Specialist)", "Full name updated");
    assert(updateRes.data.user.phone === "+91 98450 99999", "Phone number updated");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 6: Admin Can Change Roles with Proper Authorization");
  // -------------------------------------------------------------------------
  {
    const roleChangeRes = await request(`/api/admin/users/${testWorkerId}/role`, {
      method: "PATCH",
      token: adminToken,
      body: {
        role: "FACTORY",
        reason: "Promoted to factory intake weighmaster",
      },
    });

    assert(roleChangeRes.status === 200, "PATCH /api/admin/users/:id/role returns HTTP 200");
    assert(roleChangeRes.data.user.role === "FACTORY", "User role successfully changed to FACTORY");

    // Verify Audit Log recorded the role change
    const roleAudit = await AuditLogModel.findOne({
      entityId: testWorkerId,
      action: "USER_ROLE_CHANGED",
    }).lean();
    assert(roleAudit !== null, "Audit log records USER_ROLE_CHANGED");
    const auditDetails = roleAudit ? JSON.parse((roleAudit as any).detailsJson) : {};
    assert(auditDetails.previousRole === "WORKER", "Audit log records previousRole=WORKER");
    assert(auditDetails.newRole === "FACTORY", "Audit log records newRole=FACTORY");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 7: Admin Can Deactivate and Reactivate Users");
  // -------------------------------------------------------------------------
  {
    // Deactivate / Suspend
    const suspendRes = await request(`/api/admin/users/${testWorkerId}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: "SUSPENDED",
        reason: "Account suspended for annual compliance review",
      },
    });
    assert(suspendRes.status === 200, "Account deactivation returns HTTP 200");
    assert(suspendRes.data.user.status === "SUSPENDED", "Account status updated to SUSPENDED");

    // Reactivate / Approve
    const reactivateRes = await request(`/api/admin/users/${testWorkerId}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: "APPROVED",
        reason: "Compliance review completed successfully",
      },
    });
    assert(reactivateRes.status === 200, "Account reactivation returns HTTP 200");
    assert(reactivateRes.data.user.status === "APPROVED", "Account status restored to APPROVED");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 8: Deactivated Users Cannot Access Protected APIs");
  // -------------------------------------------------------------------------
  {
    // Issue token for test worker
    const workerAuthToken = jwt.sign(
      { id: testWorkerId, email: testWorkerEmail, fullName: "Arun Joshi", role: Role.FACTORY },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Active worker can access /api/auth/me
    const activeProbe = await request("/api/auth/me", { token: workerAuthToken });
    assert(activeProbe.status === 200, "Active user can access /api/auth/me");

    // Suspend worker
    await UserModel.updateOne({ _id: testWorkerId }, { status: "SUSPENDED" });

    // Suspended worker attempting access
    const suspendedProbe = await request("/api/auth/me", { token: workerAuthToken });
    assert(suspendedProbe.status === 403, "Deactivated user receives HTTP 403 Forbidden");
    assert(suspendedProbe.data.error.includes("suspended"), "Clear account suspended message returned");

    // Inactive worker attempting access
    await UserModel.updateOne({ _id: testWorkerId }, { status: "INACTIVE" });
    const inactiveProbe = await request("/api/auth/me", { token: workerAuthToken });
    assert(inactiveProbe.status === 403, "Inactive user receives HTTP 403 Forbidden");

    // Restore to APPROVED
    await UserModel.updateOne({ _id: testWorkerId }, { status: "APPROVED" });
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 9: Non-Admin Users Cannot Access User Management Endpoints");
  // -------------------------------------------------------------------------
  {
    // Worker probe
    const workerProbe = await request("/api/admin/users", { token: workerToken });
    assert(workerProbe.status === 403, "Worker access to /api/admin/users is blocked with HTTP 403");

    // Dealer probe
    const dealerProbe = await request(`/api/admin/users/${testWorkerId}`, {
      method: "PATCH",
      token: dealerToken,
      body: { fullName: "Hacked by Dealer" },
    });
    assert(dealerProbe.status === 403, "Dealer cannot modify user accounts (HTTP 403)");

    // Customer probe
    const customerProbe = await request("/api/admin/users", {
      method: "POST",
      token: customerToken,
      body: { fullName: "New User", email: "cust.hacked@ecotrace.org", role: "CUSTOMER" },
    });
    assert(customerProbe.status === 403, "Customer cannot create user accounts (HTTP 403)");

    // Unauthenticated probe
    const unauthProbe = await request("/api/admin/users");
    assert(unauthProbe.status === 401, "Unauthenticated request returns HTTP 401");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 10: Non-Admin Users Cannot Create Admin Accounts");
  // -------------------------------------------------------------------------
  {
    const publicAdminRes = await request("/api/auth/register", {
      method: "POST",
      body: {
        email: `fake.admin.${Date.now()}@ecotrace.org`,
        password: "password123",
        fullName: "Fake Admin Attacker",
        role: "ADMIN",
      },
    });

    assert(publicAdminRes.status === 403, "Public registration as ADMIN is strictly rejected with HTTP 403");
    assert(
      publicAdminRes.data.error.includes("Administrator accounts cannot be created via public registration"),
      "Helpful security message explains admin accounts require authorized admin provisioning"
    );
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 11: Ordinary Users Cannot Elevate Their Own Roles");
  // -------------------------------------------------------------------------
  {
    const escalateProbe = await request("/api/auth/profile", {
      method: "PATCH",
      token: customerToken,
      body: {
        role: "ADMIN",
        fullName: "Attacker Trying Role Elevation",
      },
    });

    assert(escalateProbe.status === 403, "Self-role escalation attempt is rejected with HTTP 403");
    assert(
      escalateProbe.data.error.includes("Modifying account role or status is restricted"),
      "Clear error message explains privilege escalation is prohibited"
    );

    // Verify role in MongoDB remains CUSTOMER
    const custInDb = await UserModel.findById((customerUser as any)._id).lean();
    assert(custInDb!.role === Role.CUSTOMER, "Database confirms user role remains CUSTOMER");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 12: The Last Active Admin Cannot Be Removed or Demoted");
  // -------------------------------------------------------------------------
  {
    // Count active admins
    const activeAdmins = await UserModel.countDocuments({
      role: Role.ADMIN,
      status: "APPROVED",
      isArchived: { $ne: true },
    });

    if (activeAdmins === 1) {
      // Attempt to demote the sole admin
      const demoteRes = await request(`/api/admin/users/${(adminUser as any)._id}/role`, {
        method: "PATCH",
        token: adminToken,
        body: { role: "CUSTOMER", reason: "Demote sole admin" },
      });
      assert(demoteRes.status === 400, "Demoting last active admin is blocked with HTTP 400");
      assert(demoteRes.data.error.includes("last active Administrator"), "Error explains system must retain an admin");

      // Attempt to delete/archive the sole admin
      const deleteRes = await request(`/api/admin/users/${(adminUser as any)._id}`, {
        method: "DELETE",
        token: adminToken,
      });
      assert(deleteRes.status === 400, "Archiving sole active admin is blocked with HTTP 400");
    } else {
      console.log(`  [INFO] Multiple admins detected (${activeAdmins}); testing self-delete block.`);
      const selfDeleteRes = await request(`/api/admin/users/${(adminUser as any)._id}`, {
        method: "DELETE",
        token: adminToken,
      });
      assert(selfDeleteRes.status === 400, "Admin cannot delete their own active account");
    }
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 13: Historical Records Remain Intact After Account Archival");
  // -------------------------------------------------------------------------
  {
    // Create a temporary driver with an associated dispatch
    const tempDriver = await UserModel.create({
      fullName: "Archive Test Driver",
      email: `driver.archive.${Date.now()}@ecotrace.org`,
      passwordHash: "dummyhash",
      role: Role.DRIVER,
      status: "APPROVED",
      isArchived: false,
    });

    const tempDispatch = await DispatchModel.create({
      dispatchId: `DISP-TEST-ARCH-${Date.now().toString().slice(-4)}`,
      batchIds: [],
      driverId: tempDriver._id.toString(),
      vehicleRegistration: "KA-01-ARCH-9999",
      originAddress: "Collection Point Peenya",
      pickupAddress: "Collection Point Peenya",
      destinationFacility: "Apex Smelting Hub",
      destinationFacilityId: new mongoose.Types.ObjectId().toString(),
      dispatchedWeightKg: 150.0,
      status: DispatchStatus.DELIVERED, // delivered so driver has no active dispatches
    });

    // Archive the driver account
    const archiveRes = await request(`/api/admin/users/${tempDriver._id}`, {
      method: "DELETE",
      token: adminToken,
      body: { reason: "Driver retired from service" },
    });

    assert(archiveRes.status === 200, "Archiving driver returns HTTP 200");

    // Verify driver status is ARCHIVED and isArchived=true
    const archivedDriverInDb = await UserModel.findById(tempDriver._id).lean();
    assert(archivedDriverInDb!.status === "ARCHIVED", "User status is set to ARCHIVED");
    assert(archivedDriverInDb!.isArchived === true, "User isArchived flag is true");

    // Verify historical dispatch record is completely intact!
    const dispatchInDb = await DispatchModel.findById(tempDispatch._id).lean();
    assert(dispatchInDb !== null, "Historical dispatch record is preserved in MongoDB");
    assert(dispatchInDb!.driverId === tempDriver._id.toString(), "Dispatch driver reference is intact");

    // Clean up test dispatch & driver
    await DispatchModel.deleteOne({ _id: tempDispatch._id });
    await UserModel.deleteOne({ _id: tempDriver._id });
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 14: Candidate / Employee ID Search Returns Correct Record");
  // -------------------------------------------------------------------------
  {
    const lookupRes = await request(`/api/admin/users/lookup/employee-id/${testWorkerEmployeeId}`, {
      token: adminToken,
    });

    assert(lookupRes.status === 200, "Lookup by employee ID returns HTTP 200");
    assert(lookupRes.data.success === true, "Lookup response success=true");
    assert(lookupRes.data.user.id === testWorkerId, "Found correct user by employee ID");
    assert(lookupRes.data.user.email === testWorkerEmail.toLowerCase(), "User email matches");

    // Test non-existent ID
    const notFoundRes = await request("/api/admin/users/lookup/employee-id/NON_EXISTENT_ID_99999", {
      token: adminToken,
    });
    assert(notFoundRes.status === 404, "Non-existent employee ID returns HTTP 404");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 15: Audit Logs Contain Correct Action Details");
  // -------------------------------------------------------------------------
  {
    const auditRes = await request(`/api/admin/users/${testWorkerId}/audit-history`, {
      token: adminToken,
    });

    assert(auditRes.status === 200, "GET /api/admin/users/:id/audit-history returns HTTP 200");
    assert(Array.isArray(auditRes.data.auditLogs), "Returns auditLogs array");
    const actions = auditRes.data.auditLogs.map((l: any) => l.action);

    assert(actions.includes("USER_CREATED"), "Audit trail contains USER_CREATED");
    assert(actions.includes("USER_UPDATED"), "Audit trail contains USER_UPDATED");
    assert(actions.includes("USER_ROLE_CHANGED"), "Audit trail contains USER_ROLE_CHANGED");
    assert(actions.includes("USER_DEACTIVATED"), "Audit trail contains USER_DEACTIVATED");
    assert(actions.includes("USER_REACTIVATED"), "Audit trail contains USER_REACTIVATED");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 16: Validation Errors Return Descriptive Details");
  // -------------------------------------------------------------------------
  {
    const badInputRes = await request("/api/admin/users", {
      method: "POST",
      token: adminToken,
      body: {
        fullName: "A", // too short
        email: "not-an-email", // invalid email
        role: "INVALID_ROLE",
      },
    });

    assert(badInputRes.status === 400, "Invalid user creation returns HTTP 400");
    assert(badInputRes.data.details !== undefined, "Descriptive validation details returned");
  }

  // -------------------------------------------------------------------------
  console.log("\nScenario 17: Existing Login & Role-Based Portals Still Work");
  // -------------------------------------------------------------------------
  {
    const rolesToTest = [
      { role: "ADMIN", email: "admin@ecotrace.org" },
      { role: "DEALER", email: "dealer@metrocollect.com" },
      { role: "DRIVER", email: "driver@greenlogistics.com" },
      { role: "FACTORY", email: "factory@apexrecycling.com" },
      { role: "WORKER", email: "worker@apexrecycling.com" },
      { role: "CUSTOMER", email: "customer@ecotrace.org" },
    ];

    let allRolesLoggedIn = true;
    for (const r of rolesToTest) {
      const loginRes = await request("/api/auth/login", {
        method: "POST",
        body: { email: r.email, password: "password123", portalRole: r.role },
      });
      if (!loginRes.ok || !loginRes.data.token) {
        allRolesLoggedIn = false;
        console.error(`Login failed for ${r.role} (${r.email}):`, loginRes.data);
      }
    }

    assert(allRolesLoggedIn, "All 6 pre-seeded role personas can authenticate cleanly with valid tokens");

    // Clean up test worker
    await UserModel.deleteOne({ _id: testWorkerId });
    await AuditLogModel.deleteMany({ entityId: testWorkerId });
  }

  await mongoose.disconnect();

  console.log("\n=======================================================================");
  console.log(`   AUDIT RESULTS: ${passedCount} PASSED | ${failedCount} FAILED       `);
  console.log("=======================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("Fatal test execution error:", err);
  process.exit(1);
});
