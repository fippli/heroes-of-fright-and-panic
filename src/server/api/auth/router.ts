import bcrypt from "bcrypt";
import express from "express";
import type { Filter } from "mongodb";
import { ObjectId } from "mongodb";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Database, User } from "../../database";

const authRouter = express.Router();

const database = new Database();

// ensure DB is connected before handling requests
database
  .connect()
  .then(() => {
    console.log("✅ Connected to MongoDB (auth)");
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB (auth):", err);
  });

// Configure Passport Local Strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const users = database.users();
      const user = await users.findOne({ username });

      if (!user) {
        return done(null, false, { message: "Incorrect username or password" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return done(null, false, { message: "Incorrect username or password" });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }),
);

// Serialize user for session
passport.serializeUser((user: any, done: (err: any, id?: string) => void) => {
  done(null, user._id.toString());
});

// Deserialize user from session
passport.deserializeUser(
  async (id: string, done: (err: any, user?: User | false) => void) => {
    try {
      const users = database.users();
      const user = await users.findOne({
        _id: new ObjectId(id),
      } as Filter<User>);

      if (!user) {
        return done(null, false);
      }

      done(null, user);
    } catch (err) {
      done(err);
    }
  },
);

// POST /signup → create a new user account
authRouter.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const users = database.users();

    // Check if user already exists
    const existingUser = await users.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const now = new Date();

    const result = await users.create({
      username,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-login after signup
    req.login({ _id: result.insertedId, username }, (err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to login after signup" });
      }
      return res.json({ success: true, userId: result.insertedId.toString() });
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// POST /login → authenticate user
authRouter.post("/login", (req, res, next) => {
  passport.authenticate("local", (err: any, user: User | false, info: any) => {
    if (err) {
      return res.status(500).json({ error: "Authentication error" });
    }

    if (!user) {
      return res
        .status(401)
        .json({ error: info?.message || "Authentication failed" });
    }

    req.login(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ error: "Login error" });
      }

      return res.json({ success: true, userId: user._id?.toString() });
    });
  })(req, res, next);
});

// POST /logout → logout user
authRouter.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.json({ success: true });
  });
});

// GET /check → check if user is authenticated
authRouter.get("/check", (req, res) => {
  if (req.isAuthenticated() && req.user) {
    const user = req.user as User;
    res.json({
      authenticated: true,
      userId: user._id?.toString(),
      username: user.username,
    });
  } else {
    res.json({ authenticated: false });
  }
});

export default authRouter;
