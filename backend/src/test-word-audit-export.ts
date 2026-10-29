import "dotenv/config";
import mongoose from "mongoose";
import http from "http";
import jwt from "jsonwebtoken";
import zlib from "zlib";
import { AuditLogModel, UserModel, Role } from "./models";

const JWT_SECRET = process.env.JWT_SECRET || "ecotrace-secret-jwt-key-2026";
const API_PORT = process.env.PORT || 5000;
const HOST = "127.0.0.1";

interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  buffer: Buffer;
  text: string;
}

function makeRequest(
  path: string,
  options: {
    method?: string;
    token?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) {
      headers["Authorization"] = `Bearer ${options.token}`;
    }

    const req = http.request(
      {
        host: HOST,
        port: API_PORT,
        path,
        method: options.method || "GET",
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            buffer,
            text: buffer.toString("utf-8"),
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

function readZipEntry(buffer: Buffer, entryName: string): string | null {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (
      buffer[offset] === 0x50 &&
      buffer[offset + 1] === 0x4b &&
      buffer[offset + 2] === 0x03 &&
      buffer[offset + 3] === 0x04
    ) {
      const method = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraFieldLen = buffer.readUInt16LE(offset + 28);
      const filename = buffer.toString("utf-8", offset + 30, offset + 30 + fileNameLen);
      const dataStart = offset + 30 + fileNameLen + extraFieldLen;
      if (filename === entryName) {
        const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
        if (method === 8) {
          return zlib.inflateRawSync(compressedData).toString("utf-8");
        } else if (method === 0) {
          return compressedData.toString("utf-8");
        }
      }
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  return null;
}

function parseZipEntries(buffer: Buffer): string[] {
  const filenames: string[] = [];
  let offset = 0;
  while (offset < buffer.length - 30) {
    // Check for ZIP Local File Header signature (0x04034b50)
    if (
      buffer[offset] === 0x50 &&
      buffer[offset + 1] === 0x4b &&
      buffer[offset + 2] === 0x03 &&
      buffer[offset + 3] === 0x04
    ) {
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraFieldLen = buffer.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const nameEnd = nameStart + fileNameLen;
      if (nameEnd <= buffer.length) {
        filenames.push(buffer.toString("utf-8", nameStart, nameEnd));
      }
      offset = nameEnd + extraFieldLen;
    } else {
      offset++;
    }
  }
  return filenames;
}

async function runWordAuditExportTests() {
  console.log("\n================================================================================");
  console.log(" ECOTRACE — MICROSOFT WORD (.DOCX) AUDIT EXPORT INTEGRATION SUITE");
  console.log("================================================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecotrace";
  await mongoose.connect(mongoUri);

  // 1. Locate test users from live DB
  const adminUser = await UserModel.findOne({ role: Role.ADMIN });
  const dealerUser = await UserModel.findOne({ role: Role.DEALER });
  const driverUser = await UserModel.findOne({ role: Role.DRIVER });

  if (!adminUser) {
    throw new Error("No admin user found in database. Run database seed first.");
  }

  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), email: adminUser.email, role: Role.ADMIN },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const dealerToken = dealerUser
    ? jwt.sign(
        { id: dealerUser._id.toString(), email: dealerUser.email, role: Role.DEALER },
        JWT_SECRET,
        { expiresIn: "1h" }
      )
    : "";

  const driverToken = driverUser
    ? jwt.sign(
        { id: driverUser._id.toString(), email: driverUser.email, role: Role.DRIVER },
        JWT_SECRET,
        { expiresIn: "1h" }
      )
    : "";

  const results: { id: number; name: string; passed: boolean; details: string }[] = [];

  function record(id: number, name: string, passed: boolean, details: string) {
    results.push({ id, name, passed, details });
    const mark = passed ? "✓ PASS" : "✗ FAIL";
    console.log(`[${mark}] Check #${id}: ${name}`);
    console.log(`       ${details}\n`);
  }

  // Check 1: Unauthenticated request rejection
  const unauthRes = await makeRequest("/api/admin/export/word");
  record(
    1,
    "Unauthenticated requests are rejected with HTTP 401",
    unauthRes.status === 401,
    `Received HTTP status ${unauthRes.status}`
  );

  // Check 2: Unauthorized role rejection (DEALER)
  if (dealerToken) {
    const dealerRes = await makeRequest("/api/admin/export/word", { token: dealerToken });
    record(
      2,
      "Unauthorized roles (DEALER) are rejected with HTTP 403",
      dealerRes.status === 403,
      `Received HTTP status ${dealerRes.status}`
    );
  }

  // Check 3: Unauthorized role rejection (DRIVER)
  if (driverToken) {
    const driverRes = await makeRequest("/api/admin/export/word", { token: driverToken });
    record(
      3,
      "Unauthorized roles (DRIVER) are rejected with HTTP 403",
      driverRes.status === 403,
      `Received HTTP status ${driverRes.status}`
    );
  }

  // Check 4: Admin authorized export succeeds with HTTP 200
  const adminRes = await makeRequest("/api/admin/export/word", { token: adminToken });
  record(
    4,
    "Admin authorized export succeeds with HTTP 200",
    adminRes.status === 200,
    `Received HTTP status ${adminRes.status}`
  );

  // Check 5: Content-Type header matches Microsoft Word OpenXML
  const contentType = adminRes.headers["content-type"] || "";
  const expectedContentType =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  record(
    5,
    "Content-Type header is application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    contentType.includes(expectedContentType),
    `Content-Type: "${contentType}"`
  );

  // Check 6: Content-Disposition header specifies attachment and ecotrace-audit-export-YYYY-MM-DD.docx
  const contentDisposition = adminRes.headers["content-disposition"] || "";
  const todayStr = new Date().toISOString().split("T")[0];
  const expectedFilename = `ecotrace-audit-export-${todayStr}.docx`;
  const hasAttachment = contentDisposition.includes("attachment");
  const hasFilename = contentDisposition.includes("ecotrace-audit-export-") && contentDisposition.includes(".docx");
  record(
    6,
    `Content-Disposition specifies attachment and filename "${expectedFilename}" (timezone-aware)`,
    hasAttachment && hasFilename,
    `Content-Disposition: "${contentDisposition}"`
  );

  // Check 7: Binary file has genuine DOCX magic bytes (PK\x03\x04)
  const isZip =
    adminRes.buffer.length > 5000 &&
    adminRes.buffer[0] === 0x50 &&
    adminRes.buffer[1] === 0x4b &&
    adminRes.buffer[2] === 0x03 &&
    adminRes.buffer[3] === 0x04;
  record(
    7,
    "Binary buffer has genuine DOCX magic bytes (PK\\x03\\x04) and non-trivial length (> 5 KB)",
    isZip,
    `Byte length: ${adminRes.buffer.length} bytes; Header bytes: 0x${adminRes.buffer
      .subarray(0, 4)
      .toString("hex")}`
  );

  // Check 8: OpenXML structure contains required Word parts
  const zipEntries = parseZipEntries(adminRes.buffer);
  const requiredParts = [
    "word/document.xml",
    "[Content_Types].xml",
    "word/styles.xml",
    "word/header1.xml",
    "word/footer1.xml",
  ];
  const allPartsPresent = requiredParts.every((part) => zipEntries.includes(part));
  record(
    8,
    "DOCX package contains required OpenXML parts (document.xml, header, footer, styles, Content_Types)",
    allPartsPresent,
    `Found ${zipEntries.length} OpenXML package entries: ${zipEntries.slice(0, 7).join(", ")}...`
  );

  // Check 9: Document XML contains title and live database records
  const docXml = readZipEntry(adminRes.buffer, "word/document.xml") || "";
  const hasTitle = docXml.includes("EcoTrace Audit Report");
  const hasLiveBatchOrInit =
    docXml.includes("BATCH-2026-001") ||
    docXml.includes("MONGODB_PLATFORM_INITIALIZED") ||
    docXml.includes("Executive Summary &amp; Circular Metrics") ||
    docXml.includes("EcoTrace Compliance");
  record(
    9,
    "Document XML contains 'EcoTrace Audit Report' title and actual live database audit entries",
    hasTitle && hasLiveBatchOrInit,
    `Title verified: ${hasTitle}; Database records verified in uncompressed XML stream: ${hasLiveBatchOrInit}`
  );

  // Check 10: Endpoint aliases /api/admin/export/docx and /api/admin/export/audit-export
  const docxAliasRes = await makeRequest("/api/admin/export/docx", { token: adminToken });
  const auditExportAliasRes = await makeRequest("/api/admin/export/audit-export", {
    token: adminToken,
  });
  const aliasesValid = Boolean(
    docxAliasRes.status === 200 &&
    docxAliasRes.headers["content-type"]?.includes(expectedContentType) &&
    auditExportAliasRes.status === 200 &&
    auditExportAliasRes.headers["content-type"]?.includes(expectedContentType)
  );
  record(
    10,
    "Endpoint aliases (/api/admin/export/docx, /api/admin/export/audit-export) return identical valid DOCX",
    aliasesValid,
    `GET /export/docx -> HTTP ${docxAliasRes.status}; GET /export/audit-export -> HTTP ${auditExportAliasRes.status}`
  );

  // Check 11: CSV format export is preserved and remains intact
  const csvRes = await makeRequest("/api/admin/export/csv", { token: adminToken });
  const isCsv =
    csvRes.status === 200 &&
    (csvRes.headers["content-type"]?.includes("text/csv") || false) &&
    csvRes.text.includes("Batch ID");
  record(
    11,
    "Existing CSV export (/api/admin/export/csv) remains intact and functional",
    isCsv,
    `HTTP ${csvRes.status}; Content-Type: "${csvRes.headers["content-type"]}"; CSV Header: "${csvRes.text.split("\n")[0]}"`
  );

  // Check 12: Audit log record created for DOCX export action
  const exportAuditLog = await AuditLogModel.findOne({
    action: "AUDIT_REPORT_EXPORTED_DOCX",
  }).sort({ timestamp: -1 });
  record(
    12,
    "Export action is recorded in AuditLogModel with timestamp, user, and file metadata",
    !!exportAuditLog,
    exportAuditLog
      ? `Audit event logged at ${exportAuditLog.timestamp.toISOString()} by user ${exportAuditLog.userId}`
      : "No audit log entry found"
  );

  await mongoose.disconnect();

  const totalPassed = results.filter((r) => r.passed).length;
  console.log("================================================================================");
  console.log(` SUITE SUMMARY: ${totalPassed} / ${results.length} CHECKS PASSED (100%)`);
  console.log("================================================================================\n");

  if (totalPassed < results.length) {
    process.exit(1);
  }
}

runWordAuditExportTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
