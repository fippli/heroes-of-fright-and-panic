import express from "express";
import crypto from "crypto";
import { Database } from "../../database";
import { ObjectId } from "mongodb";
import { sendMagicLinkEmail, isSmtpConfigured } from "../../services/mail";

const authRouter = express.Router();
const database = new Database();

// Initialize database connection
database.connect().catch(console.error);

// Token expiry times
const MAGIC_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Generate a secure random token
 */
const generateToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * POST /api/auth/magic-link
 * Request a magic link to be sent to the user's email
 */
authRouter.post("/magic-link", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate magic token
    const token = generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAGIC_TOKEN_EXPIRY_MS);

    // Store the token
    await database.magicTokens().create({
      token,
      email: normalizedEmail,
      createdAt: now,
      expiresAt,
    });

    // Build magic link URL
    const baseUrl =
      process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const magicLink = `${baseUrl}/auth/verify?token=${token}`;

    // Send the magic link email
    const emailSent = await sendMagicLinkEmail(normalizedEmail, magicLink);

    if (!emailSent && isSmtpConfigured) {
      // SMTP is configured but email failed to send
      res
        .status(500)
        .json({ error: "Failed to send magic link email. Please try again." });
      return;
    }

    res.json({
      success: true,
      message: isSmtpConfigured
        ? "Magic link sent! Check your email."
        : "Magic link sent! Check your email (or server console in dev mode).",
    });
  } catch (error) {
    console.error("Error creating magic link:", error);
    res.status(500).json({ error: "Failed to create magic link" });
  }
});

/**
 * GET /api/auth/verify
 * Verify a magic link token and create a session
 */
authRouter.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Token is required" });
      return;
    }

    // Find the token
    const magicToken = await database.magicTokens().findOne({ token });

    if (!magicToken) {
      res.status(400).json({ error: "Invalid or expired token" });
      return;
    }

    // Check if token is expired
    if (new Date() > magicToken.expiresAt) {
      res.status(400).json({ error: "Token has expired" });
      return;
    }

    // Check if token was already used
    if (magicToken.usedAt) {
      res.status(400).json({ error: "Token has already been used" });
      return;
    }

    // Mark token as used
    await database
      .magicTokens()
      .updateOne({ _id: magicToken._id }, { $set: { usedAt: new Date() } });

    // Find or create user
    let user = await database.users().findOne({ email: magicToken.email });

    if (!user) {
      // Create new user
      const result = await database.users().create({
        email: magicToken.email,
        createdAt: new Date(),
      });
      user = await database.users().findOne({ _id: result.insertedId });
    }

    if (!user) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }

    // Update last login
    await database
      .users()
      .updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    // Create session
    const sessionId = generateToken();
    const now = new Date();
    const sessionExpiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);

    await database.sessions().create({
      sessionId,
      userId: user._id,
      email: user.email,
      createdAt: now,
      expiresAt: sessionExpiresAt,
    });

    // Set session cookie
    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_MS,
    });

    // Redirect to home or game page
    res.redirect("/");
  } catch (error) {
    console.error("Error verifying magic link:", error);
    res.status(500).json({ error: "Failed to verify magic link" });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
authRouter.get("/me", async (req, res) => {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const session = await database.sessions().findOne({ sessionId });

    if (!session || new Date() > session.expiresAt) {
      res.clearCookie("session");
      res.status(401).json({ error: "Session expired" });
      return;
    }

    const user = await database.users().findOne({ _id: session.userId });

    if (!user) {
      res.clearCookie("session");
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("Error getting current user:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

/**
 * POST /api/auth/logout
 * Log out the current user
 */
authRouter.post("/logout", async (req, res) => {
  try {
    const sessionId = req.cookies?.session;

    if (sessionId) {
      // Delete the session from database
      await database.sessions().deleteOne({ sessionId });
    }

    res.clearCookie("session");
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ error: "Failed to log out" });
  }
});

export default authRouter;
