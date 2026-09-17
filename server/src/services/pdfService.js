/**
 * PDF Service — High-Fidelity Server-Side PDF Generation via Puppeteer.
 *
 * Reuses the existing frontend brochure route (/bookings/:id/voucher) with
 * a short-lived (60s) scoped JWT service token to capture pixel-perfect,
 * selectable-text A4 PDFs matching print CSS without duplicating templates.
 */

import puppeteer from "puppeteer";
import jwt from "jsonwebtoken";
import config from "../config/index.js";

let browserPromise = null;

/**
 * Generates a 60-second scoped service token for Puppeteer rendering.
 * Strictly bound to this booking ID and type 'brochure_render'.
 *
 * @param {string} bookingId - MongoDB ObjectId or bookingId string
 * @returns {string} JWT service token
 */
export function generateBrochureServiceToken(bookingId) {
  return jwt.sign(
    {
      sub: "brochure_service",
      type: "brochure_render",
      bookingId: bookingId.toString(),
    },
    config.jwt.secret,
    { expiresIn: "60s" }
  );
}

/**
 * Gets or initializes a singleton Puppeteer browser instance.
 */
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--font-render-hinting=medium",
        ],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }

  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

/**
 * Closes the browser instance if open (useful for test teardown and process exit).
 */
export async function closeBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch {
      // ignore
    } finally {
      browserPromise = null;
    }
  }
}

/**
 * Renders the frontend voucher route into an A4 PDF buffer using Puppeteer.
 *
 * @param {string} bookingId - The booking ID to render
 * @param {Object} [options] - Optional overrides (timeout, format)
 * @returns {Promise<Buffer>} PDF Buffer
 */
export async function generateBrochurePdf(bookingId, options = {}) {
  const serviceToken = generateBrochureServiceToken(bookingId);
  const withHeader = options.withHeader !== undefined ? Boolean(options.withHeader) : true;
  const targetUrl = `${config.frontendUrl}/bookings/${bookingId}/voucher?serviceToken=${serviceToken}&withHeader=${withHeader}`;

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set 2x device pixel ratio for crisp rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("[puppeteer-console]", msg.text()));
    page.on("pageerror", (err) => console.log("[puppeteer-error]", err.message));

    const timeout = options.timeout || 30000;

    // Navigate to voucher page
    await page.goto(targetUrl, {
      waitUntil: "networkidle0",
      timeout,
    });

    // Wait for the voucher document to declare itself ready
    await page.waitForSelector('[data-pdf-ready="true"]', {
      timeout: 15000,
    });

    await page.waitForSelector("#voucher-document", {
      timeout: 10000,
    });

    // Emulate print media type so @media print rules apply (.print-hidden, margins)
    await page.emulateMediaType("print");

    // Generate selectable-text A4 PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
  }
}

export default {
  generateBrochureServiceToken,
  generateBrochurePdf,
  closeBrowser,
};
