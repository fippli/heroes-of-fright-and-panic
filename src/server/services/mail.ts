import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// SMTP Configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "noreply@example.com";
const SMTP_SECURE = process.env.SMTP_SECURE === "true"; // true for 465, false for other ports

// Check if SMTP is configured
const isSmtpConfigured = SMTP_HOST && SMTP_USER && SMTP_PASS;

// Create transporter (only if SMTP is configured)
let transporter: Transporter | null = null;

if (isSmtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // Verify connection on startup
  transporter.verify((error) => {
    if (error) {
      console.error("❌ SMTP connection failed:", error.message);
    } else {
      console.log("✅ SMTP server is ready to send emails");
    }
  });
} else {
  console.log("⚠️ SMTP not configured - emails will be logged to console");
  console.log("   Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables to enable email sending");
}

interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using the configured SMTP server.
 * Falls back to console logging if SMTP is not configured.
 */
export async function sendMail(options: SendMailOptions): Promise<boolean> {
  const { to, subject, text, html } = options;

  if (!transporter) {
    // SMTP not configured - log to console instead
    console.log("\n========================================");
    console.log("📧 EMAIL (console mode - SMTP not configured)");
    console.log("========================================");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("----------------------------------------");
    console.log(text || html || "(no content)");
    console.log("========================================\n");
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    });

    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return false;
  }
}

/**
 * Send a magic link email for authentication.
 */
export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<boolean> {
  const subject = "🔮 Your Magic Link - Heroes of Fright and Panic";

  const text = `
Hello!

Click the link below to sign in to Heroes of Fright and Panic:

${magicLink}

This link will expire in 15 minutes.

If you didn't request this link, you can safely ignore this email.

Happy gaming!
- The Heroes of Fright and Panic Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 40px 20px; margin: 0;">
  <div style="max-width: 500px; margin: 0 auto; background: rgba(255,255,255,0.05); border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <span style="font-size: 48px;">🔮</span>
    </div>
    
    <h1 style="text-align: center; font-size: 24px; margin-bottom: 10px; background: linear-gradient(90deg, #ffd700, #ff8c00); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
      Heroes of Fright and Panic
    </h1>
    
    <p style="text-align: center; color: #888; margin-bottom: 30px;">
      Click the button below to sign in
    </p>
    
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="${magicLink}" style="display: inline-block; background: linear-gradient(90deg, #ffd700, #ff8c00); color: #000; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Sign In ✨
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px; text-align: center; margin-bottom: 20px;">
      This link will expire in 15 minutes.
    </p>
    
    <p style="color: #444; font-size: 12px; text-align: center;">
      If you didn't request this link, you can safely ignore this email.
    </p>
    
    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0;">
    
    <p style="color: #444; font-size: 12px; text-align: center;">
      Can't click the button? Copy and paste this link:<br>
      <a href="${magicLink}" style="color: #ffd700; word-break: break-all;">${magicLink}</a>
    </p>
  </div>
</body>
</html>
`.trim();

  return sendMail({ to: email, subject, text, html });
}

export { isSmtpConfigured };
