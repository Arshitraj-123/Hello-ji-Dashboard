import puppeteer from "puppeteer";
import path from "path";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import config from "../config/index.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { generateBrochureServiceToken } from "../services/pdfService.js";

const ARTIFACTS_DIR = "C:/Users/Arshit Raj/.gemini/antigravity-ide/brain/b63be29a-2f0d-4122-9894-4968d43d5520";

async function main() {
  await mongoose.connect(config.mongoUri);
  const admin = await User.findOne({ email: "admin@helloji.in" });
  const token = jwt.sign(
    { id: admin._id.toString(), role: admin.role, permissions: admin.permissions },
    config.jwt.secret,
    { expiresIn: "1h" }
  );

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // Set auth cookie / localStorage
  await page.goto("http://localhost:8080/dashboard", { waitUntil: "domcontentloaded" });
  await page.evaluate((tok, usr) => {
    localStorage.setItem("helloji_token", tok);
    localStorage.setItem("helloji_user", JSON.stringify(usr));
  }, token, { id: admin._id, name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions });

  // 1. Dashboard screenshot
  console.log("Capturing Dashboard...");
  await page.goto("http://localhost:8080/dashboard", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "rev_dashboard_charts.png") });

  // 2. Calendar screenshot
  console.log("Capturing Calendar with Legend and Export...");
  await page.goto("http://localhost:8080/calendar", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "rev_calendar_legend.png") });

  // Click an event pill to open Radix Dialog
  console.log("Opening calendar modal...");
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector("button.truncate");
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (clicked) {
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "rev_calendar_modal.png") });
    console.log("Captured rev_calendar_modal.png!");
  }

  // 3. Queries table screenshot showing ExportToolbar
  console.log("Capturing Queries table with ExportToolbar...");
  await page.goto("http://localhost:8080/queries", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "rev_table_export_toolbar.png") });

  // 4. Voucher With Header
  const testBooking = await Booking.findOne({ status: "booked", deletedAt: null });
  const bId = testBooking._id.toString();
  const serviceToken = generateBrochureServiceToken(bId);
  console.log(`Capturing Voucher for ${testBooking.bookingId} (${bId}) With Header...`);
  await page.goto(`http://localhost:8080/bookings/${bId}/voucher?serviceToken=${serviceToken}&withHeader=true`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "rev_voucher_with_header.png") });

  // 5. Voucher Without Header
  console.log(`Capturing Voucher for ${testBooking.bookingId} (${bId}) Without Header...`);
  await page.goto(`http://localhost:8080/bookings/${bId}/voucher?serviceToken=${serviceToken}&withHeader=false`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "rev_voucher_without_header.png") });

  console.log("All screenshots captured successfully!");
  await browser.close();
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Screenshot capture failed:", e);
  process.exit(1);
});
