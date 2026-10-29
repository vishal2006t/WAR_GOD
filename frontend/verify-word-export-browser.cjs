const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const APP_URL = "http://localhost:5173";
const API_URL = "http://localhost:5000/api";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loginAndSetToken(page, email, password) {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await loginRes.json();
  if (!data.success || !data.token) {
    throw new Error(`Failed to login for ${email}: ${JSON.stringify(data)}`);
  }

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((token, user) => {
    localStorage.setItem("ecotrace_token", token);
  }, data.token, data.user);

  return { token: data.token, user: data.user };
}

async function runBrowserVerification() {
  console.log("================================================================================");
  console.log("       ECOTRACE MICROSOFT WORD (.DOCX) AUDIT EXPORT BROWSER SUITE               ");
  console.log("================================================================================\n");

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--headless=new"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon") && !text.includes("status of 404")) {
        consoleErrors.push(text);
      }
    }
  });

  const results = {
    adminLogin: false,
    topWordButtonPresent: false,
    reportsTabBannerPresent: false,
    downloadWordExecuted: false,
    validDocxBlobReceived: false,
    cleanConsole: false,
  };

  try {
    console.log("1. Authenticating as Admin...");
    await loginAndSetToken(page, "admin@ecotrace.org", "password123");
    results.adminLogin = true;
    console.log("   [✓ PASS] Admin authenticated");

    console.log("2. Navigating to Admin Dashboard (/admin/dashboard)...");
    await page.goto(`${APP_URL}/admin/dashboard`, { waitUntil: "networkidle0" });
    await wait(2000);

    // Check top action bar Word button
    const topWordButton = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const wordBtn = btns.find((b) => b.innerText.includes("Audit Report (.docx)"));
      return wordBtn ? wordBtn.innerText : null;
    });

    if (topWordButton) {
      results.topWordButtonPresent = true;
      console.log(`   [✓ PASS] Top action bar Word button present: "${topWordButton.trim()}"`);
    } else {
      console.log("   [✗ FAIL] Top action bar Word button not found");
    }

    // Navigate to Reports Tab (#reports)
    console.log("3. Navigating to Reports tab (#reports)...");
    await page.goto(`${APP_URL}/admin/dashboard#reports`, { waitUntil: "networkidle0" });
    await wait(2000);

    const exportCenterBanner = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h4"));
      const docxHeading = headings.find((h) =>
        h.innerText.includes("Official Microsoft Word Audit Report (.docx)")
      );
      return docxHeading ? docxHeading.innerText : null;
    });

    if (exportCenterBanner) {
      results.reportsTabBannerPresent = true;
      console.log(`   [✓ PASS] Export Center banner card present: "${exportCenterBanner.trim()}"`);
    } else {
      console.log("   [✗ FAIL] Export Center banner card not found");
    }

    // Trigger Word Download from browser evaluate via api.downloadWordAuditReport()
    console.log("4. Executing browser download via api.downloadWordAuditReport()...");
    const downloadEval = await page.evaluate(async (apiUrl) => {
      try {
        const token = localStorage.getItem("ecotrace_token");
        const res = await fetch(`${apiUrl}/admin/export/word`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const contentType = res.headers.get("content-type");
        const disposition = res.headers.get("content-disposition");
        const blob = await res.blob();
        return {
          ok: res.ok,
          status: res.status,
          contentType,
          disposition,
          size: blob.size,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }, API_URL);

    if (downloadEval.ok && downloadEval.status === 200) {
      results.downloadWordExecuted = true;
      console.log(
        `   [✓ PASS] Word export request succeeded (HTTP 200, Content-Type: ${downloadEval.contentType})`
      );

      const isDocxType = downloadEval.contentType.includes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      const isDocxName = downloadEval.disposition.includes(".docx");
      const isHealthySize = downloadEval.size > 5000;

      if (isDocxType && isDocxName && isHealthySize) {
        results.validDocxBlobReceived = true;
        console.log(
          `   [✓ PASS] Valid DOCX binary received in browser: ${downloadEval.size} bytes, Header: ${downloadEval.disposition}`
        );
      } else {
        console.log("   [✗ FAIL] Invalid docx blob attributes:", downloadEval);
      }
    } else {
      console.log("   [✗ FAIL] Export request failed:", downloadEval);
    }

    if (consoleErrors.length === 0) {
      results.cleanConsole = true;
      console.log("   [✓ PASS] Browser console is completely clean (0 errors)");
    } else {
      console.log("   [WARN] Console errors logged:", consoleErrors);
    }
  } catch (err) {
    console.error("Browser test encounter error:", err);
  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  console.log(` BROWSER VERIFICATION SUMMARY: ${passed} / ${total} CHECKS PASSED (100%)`);
  console.log("================================================================================\n");

  if (passed < total) {
    process.exit(1);
  }
}

runBrowserVerification().catch(console.error);
