// app/api/contact/route.ts
//
// POST /api/contact
//
// Accepts a JSON body { name, email, message }, validates it,
// checks rate limit, then sends an email via Gmail SMTP using Nodemailer.
//
// Environment variables required (set in .env.local):
//   GMAIL_USER          — the Gmail address used to send
//   GMAIL_APP_PASSWORD  — Google App Password (not your account password)
//   CONTACT_RECEIVER    — the address that receives the email
//
// Rate limit:  5 requests per IP per 10 minutes (in-memory, resets on deploy)
// Validation:  name required, email valid format, message ≥ 10 chars
//
// Response shape:
//   200  { success: true,  message: string }
//   400  { success: false, message: string }   — validation failure
//   429  { success: false, message: string }   — rate limit exceeded
//   500  { success: false, message: string }   — send failure

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// ============================================================
// Types
// ============================================================

type ContactPayload = {
    name: string;
    email: string;
    message: string;
};

type ApiResponse = {
    success: boolean;
    message: string;
};

// ============================================================
// In-memory rate limiter
//
// Stores a request log per IP: { count, windowStart }
// Checked on every request; expired windows are reset.
//
// Trade-off: resets on server restart / new deployment.
// For production at scale, replace with Redis (upstash/redis or similar).
// For a personal portfolio receiving occasional messages, this is correct.
// ============================================================

type RateLimitEntry = {
    count: number;
    windowStart: number; // ms timestamp
};

const RATE_LIMIT_MAX = 5; // max requests
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes in ms

// Module-level Map — survives across requests in the same Node.js process
const rateLimitMap = new Map<string, RateLimitEntry>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        // No prior entry or window has expired — start a fresh window
        rateLimitMap.set(ip, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        // Within the window, over the limit
        return true;
    }

    // Within the window, under the limit — increment
    entry.count += 1;
    return false;
}

// ============================================================
// Validation
// ============================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body: Partial<ContactPayload>): string | null {
    const { name, email, message } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
        return "Name is required.";
    }
    if (name.trim().length > 100) {
        return "Name must be 100 characters or fewer.";
    }
    if (!email || typeof email !== "string" || email.trim().length === 0) {
        return "Email is required.";
    }
    if (!EMAIL_REGEX.test(email.trim())) {
        return "Please enter a valid email address.";
    }
    if (
        !message ||
        typeof message !== "string" ||
        message.trim().length === 0
    ) {
        return "Message is required.";
    }
    if (message.trim().length < 10) {
        return "Message must be at least 10 characters.";
    }
    if (message.trim().length > 5000) {
        return "Message must be 5000 characters or fewer.";
    }

    return null; // valid
}

// ============================================================
// Nodemailer transporter
//
// Created lazily (on first request) and reused across requests.
// Using Gmail SMTP with an App Password:
//   1. Enable 2-Step Verification on the Gmail account
//   2. Go to Google Account → Security → App Passwords
//   3. Generate a password for "Mail" on "Other device"
//   4. Use that 16-character password as GMAIL_APP_PASSWORD
// ============================================================

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
    if (transporter) return transporter;

    const user = process.env.GMAIL_USER;
    const password = process.env.GMAIL_APP_PASSWORD;

    if (!user || !password) {
        throw new Error(
            "[contact API] GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local",
        );
    }

    transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass: password },
    });

    return transporter;
}

// ============================================================
// Email HTML template
// ============================================================

function buildEmailHtml(name: string, email: string, message: string): string {
    const timestamp = new Date().toLocaleString("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
    });

    // Escape user input for safe HTML rendering
    const escape = (str: string) =>
        str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/\n/g, "<br>");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Contact</title>
</head>
<body style="margin:0;padding:0;background:#0e0f11;font-family:'Arial',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0f11;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e2126;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#141518;padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#c9a86c;">
                Portfolio — New Message
              </p>
              <p style="margin:8px 0 0;font-size:22px;font-weight:700;color:#e8eaf0;letter-spacing:-0.02em;">
                randyrafael.my.id
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <!-- Row: Name -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding-bottom:6px;">
                    <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#5c6270;">Name</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#252830;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px 16px;">
                    <p style="margin:0;font-size:14px;color:#e8eaf0;">${escape(name)}</p>
                  </td>
                </tr>
              </table>

              <!-- Row: Email -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding-bottom:6px;">
                    <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#5c6270;">Email</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#252830;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px 16px;">
                    <a href="mailto:${escape(email)}" style="font-size:14px;color:#c9a86c;text-decoration:none;">${escape(email)}</a>
                  </td>
                </tr>
              </table>

              <!-- Row: Message -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding-bottom:6px;">
                    <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#5c6270;">Message</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#252830;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;">
                    <p style="margin:0;font-size:14px;color:#9da3b0;line-height:1.7;">${escape(message)}</p>
                  </td>
                </tr>
              </table>

              <!-- Row: Timestamp -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-family:monospace;font-size:11px;color:#5c6270;letter-spacing:0.04em;">
                      Received: ${timestamp} WIB
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#141518;padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-family:monospace;font-size:10px;color:#5c6270;letter-spacing:0.06em;">
                Sent from portfolio contact form · randyrafael.my.id
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// Plain-text fallback for email clients that don't render HTML
function buildEmailText(name: string, email: string, message: string): string {
    const timestamp = new Date().toLocaleString("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
    });

    return [
        "New Portfolio Message — randyrafael.my.id",
        "=".repeat(40),
        "",
        `Name:      ${name}`,
        `Email:     ${email}`,
        `Received:  ${timestamp} WIB`,
        "",
        "Message:",
        "-".repeat(40),
        message,
        "-".repeat(40),
        "",
        "Sent from portfolio contact form.",
    ].join("\n");
}

// ============================================================
// Route handler
// ============================================================

export async function POST(
    request: NextRequest,
): Promise<NextResponse<ApiResponse>> {
    // ---- 1. Extract IP for rate limiting ----
    // x-forwarded-for is set by Vercel / reverse proxies.
    // Fall back to a single sentinel so the limiter still works locally.
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "unknown";

    // ---- 2. Rate limit check ----
    if (isRateLimited(ip)) {
        return NextResponse.json(
            {
                success: false,
                message:
                    "Too many requests. Please wait 10 minutes before trying again.",
            },
            { status: 429 },
        );
    }

    // ---- 3. Parse body ----
    let body: Partial<ContactPayload>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid request body." },
            { status: 400 },
        );
    }

    // ---- 4. Validate ----
    const validationError = validate(body);
    if (validationError) {
        return NextResponse.json(
            { success: false, message: validationError },
            { status: 400 },
        );
    }

    // At this point body is known-valid
    const { name, email, message } = body as ContactPayload;
    const receiver = process.env.CONTACT_RECEIVER;

    if (!receiver) {
        console.error("[contact API] CONTACT_RECEIVER is not set");
        return NextResponse.json(
            {
                success: false,
                message: "Server configuration error. Please email directly.",
            },
            { status: 500 },
        );
    }

    // ---- 5. Send email ----
    try {
        const transport = getTransporter();

        await transport.sendMail({
            from: `"Client — Portfolio" <${process.env.GMAIL_USER}>`,
            to: receiver,
            replyTo: email.trim(),
            subject: "New Portfolio Message — randyrafael.my.id",
            text: buildEmailText(name.trim(), email.trim(), message.trim()),
            html: buildEmailHtml(name.trim(), email.trim(), message.trim()),
        });

        return NextResponse.json(
            {
                success: true,
                message: "Message sent. I'll get back to you within 24 hours.",
            },
            { status: 200 },
        );
    } catch (err) {
        console.error("[contact API] Nodemailer error:", err);
        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to send your message. Please try emailing directly.",
            },
            { status: 500 },
        );
    }
}

// Reject non-POST methods cleanly
export async function GET(): Promise<NextResponse<ApiResponse>> {
    return NextResponse.json(
        { success: false, message: "Method not allowed." },
        { status: 405 },
    );
}
