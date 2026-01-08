/**
 * Script to delete all games from the database
 * Run with: npx tsx scripts/delete-all-games.ts
 *
 * Make sure MONGODB_URI environment variable is set or exists in .env.secrets
 */

import { readFileSync } from "fs";
import { MongoClient } from "mongodb";

// Load environment variables from .env.secrets if it exists
function loadEnvFile() {
  try {
    const envFile = readFileSync(".env.secrets", "utf-8");
    envFile.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts
            .join("=")
            .trim()
            .replace(/^["']|["']$/g, "");
          if (value && !process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  } catch (error) {
    // .env.secrets doesn't exist, that's okay
  }
}

async function deleteAllGames() {
  // Load env vars first
  loadEnvFile();

  // Try to get MONGODB_URI from env, or use default local MongoDB
  const mongodbUri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/forest-game";

  console.log(`Using MongoDB URI: ${mongodbUri.replace(/\/\/.*@/, "//***@")}`); // Hide credentials if present

  const client = new MongoClient(mongodbUri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("forest-game");
    const gamesCollection = db.collection("games");

    // Delete all games
    const result = await gamesCollection.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} game(s) from the database`);

    await client.close();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error deleting games:", error);
    await client.close();
    process.exit(1);
  }
}

deleteAllGames();
