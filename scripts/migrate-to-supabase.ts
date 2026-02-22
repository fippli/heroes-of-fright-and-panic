/**
 * Migration script: MongoDB to Supabase
 *
 * This script migrates game data from MongoDB to Supabase.
 * Users will re-authenticate via magic link (creates Supabase account on first login).
 *
 * Prerequisites:
 * 1. Set up your Supabase project and run the schema SQL
 * 2. Set environment variables:
 *    - MONGODB_URI: Your MongoDB connection string
 *    - SUPABASE_URL: Your Supabase project URL
 *    - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 *
 * Usage:
 *   pnpm add -D mongodb  # Temporarily add mongodb for migration
 *   npx tsx scripts/migrate-to-supabase.ts
 *   pnpm remove mongodb  # Remove after migration
 */

import { MongoClient } from "mongodb";
import { createClient } from "@supabase/supabase-js";

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI environment variable is not set");
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error("Error: SUPABASE_URL environment variable is not set");
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set",
  );
  process.exit(1);
}

// MongoDB game type (old schema)
interface MongoGame {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
  name?: string;
  size: number;
  tiles: unknown[];
  dayPlayer: unknown;
  nightPlayer: unknown;
  currentPlayer: "day" | "night";
  clock: {
    time: number;
    hasDawned: boolean;
    hasDusked: boolean;
  };
  creatorEmail?: string;
  dayPlayerEmail?: string | null;
  nightPlayerEmail?: string | null;
  dayPlayerLastMove?: Date | null;
  nightPlayerLastMove?: Date | null;
  invitedEmail?: string | null;
  gameOver?: boolean;
  winner?: "day" | "night" | null;
}

// Supabase game row type (new schema)
interface SupabaseGameRow {
  name: string | null;
  size: number;
  tiles: unknown[];
  day_player: unknown;
  night_player: unknown;
  current_player: "day" | "night";
  clock: {
    time: number;
    hasDawned: boolean;
    hasDusked: boolean;
  };
  creator_email: string;
  day_player_email: string | null;
  night_player_email: string | null;
  day_player_last_move: string | null;
  night_player_last_move: string | null;
  invited_email: string | null;
  game_over: boolean;
  winner: "day" | "night" | null;
  created_at: string;
  updated_at: string;
}

async function migrate() {
  console.log("Starting migration from MongoDB to Supabase...\n");

  // Connect to MongoDB
  console.log("Connecting to MongoDB...");
  const mongoClient = new MongoClient(MONGODB_URI!);
  await mongoClient.connect();
  const db = mongoClient.db("forest-game");
  console.log("Connected to MongoDB");

  // Connect to Supabase
  console.log("Connecting to Supabase...");
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log("Connected to Supabase\n");

  // Fetch all games from MongoDB
  console.log("Fetching games from MongoDB...");
  const mongoGames = (await db
    .collection("games")
    .find({})
    .toArray()) as unknown as MongoGame[];
  console.log(`Found ${mongoGames.length} games in MongoDB\n`);

  if (mongoGames.length === 0) {
    console.log("No games to migrate.");
    await mongoClient.close();
    return;
  }

  // Transform and insert games into Supabase
  console.log("Migrating games to Supabase...");
  let successCount = 0;
  let errorCount = 0;

  for (const mongoGame of mongoGames) {
    try {
      // Transform to Supabase schema (snake_case)
      const supabaseGame: SupabaseGameRow = {
        name: mongoGame.name || null,
        size: mongoGame.size,
        tiles: mongoGame.tiles,
        day_player: mongoGame.dayPlayer,
        night_player: mongoGame.nightPlayer,
        current_player: mongoGame.currentPlayer,
        clock: mongoGame.clock,
        creator_email: mongoGame.creatorEmail || "unknown@example.com",
        day_player_email: mongoGame.dayPlayerEmail || null,
        night_player_email: mongoGame.nightPlayerEmail || null,
        day_player_last_move: mongoGame.dayPlayerLastMove
          ? mongoGame.dayPlayerLastMove.toISOString()
          : null,
        night_player_last_move: mongoGame.nightPlayerLastMove
          ? mongoGame.nightPlayerLastMove.toISOString()
          : null,
        invited_email: mongoGame.invitedEmail || null,
        game_over: mongoGame.gameOver || false,
        winner: mongoGame.winner || null,
        created_at: mongoGame.createdAt.toISOString(),
        updated_at: mongoGame.updatedAt.toISOString(),
      };

      // Insert into Supabase
      const { error } = await supabase.from("games").insert(supabaseGame);

      if (error) {
        console.error(
          `Error migrating game ${mongoGame._id.toString()}:`,
          error.message,
        );
        errorCount++;
      } else {
        console.log(`Migrated game: ${mongoGame._id.toString()}`);
        successCount++;
      }
    } catch (err) {
      console.error(
        `Error processing game ${mongoGame._id.toString()}:`,
        err instanceof Error ? err.message : err,
      );
      errorCount++;
    }
  }

  // Close MongoDB connection
  await mongoClient.close();

  // Summary
  console.log("\n========================================");
  console.log("Migration Complete!");
  console.log("========================================");
  console.log(`Total games in MongoDB: ${mongoGames.length}`);
  console.log(`Successfully migrated: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log("========================================");

  if (errorCount > 0) {
    console.log(
      "\nSome games failed to migrate. Check the errors above for details.",
    );
  }

  console.log("\nNote: Users will need to sign in again via magic link.");
  console.log(
    "Their accounts will be created in Supabase Auth on first login.",
  );
}

// Run migration
migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
