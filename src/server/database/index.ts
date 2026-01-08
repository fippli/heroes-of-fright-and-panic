// src/database/index.ts
import {
  MongoClient,
  Db,
  Collection as MongoCollection,
  ObjectId,
} from "mongodb";

import type {
  InsertOneResult,
  Filter,
  UpdateFilter,
  Document,
  WithId,
  OptionalUnlessRequiredId,
} from "mongodb";
import { Tile } from "../../shared/map/tile";
import { Player } from "@shared/player";

// Narrow environment variable to a definite string
const MONGODB_URI: string = (() => {
  const v = process.env.MONGODB_URI;
  if (!v) throw new Error("MONGODB_URI is not set");
  return v;
})();

// Clock state for the game
export interface GameClock {
  time: number; // Hour of day (0-23), advances with actions
  hasDawned: boolean;
  hasDusked: boolean;
}

// User account
export interface User extends Document {
  _id?: ObjectId;
  email: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

// Magic link token for passwordless auth
export interface MagicToken extends Document {
  _id?: ObjectId;
  token: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
}

// Session for authenticated users
export interface Session extends Document {
  _id?: ObjectId;
  sessionId: string;
  userId: ObjectId;
  email: string;
  createdAt: Date;
  expiresAt: Date;
}

// Your entity should be a Document
export interface Game extends Document {
  _id?: ObjectId; // optional when creating; will be required on reads via WithId<T>
  createdAt: Date;
  updatedAt: Date;
  tiles: Tile[];
  dayPlayer: Player;
  nightPlayer: Player;
  currentPlayer: "day" | "night"; // Which player's turn it is
  clock: GameClock; // Game time state
  size: number;
  name?: string; // Game name
  creatorEmail?: string; // Email of the game creator
  dayPlayerEmail?: string | null; // Email of the day player
  nightPlayerEmail?: string | null; // Email of the night player
  dayPlayerLastMove?: Date | null; // Last move timestamp for day player
  nightPlayerLastMove?: Date | null; // Last move timestamp for night player
  invitedEmail?: string | null; // Email of invited player
}

class Repository<TSchema extends Document> {
  private collection: MongoCollection<TSchema>;

  constructor(collection: MongoCollection<TSchema>) {
    this.collection = collection;
  }

  // insertOne expects OptionalUnlessRequiredId<TSchema>
  async create(
    doc: OptionalUnlessRequiredId<TSchema>,
  ): Promise<InsertOneResult<TSchema>> {
    return this.collection.insertOne(doc);
  }

  // findOne returns WithId<TSchema> | null
  async findOne(filter: Filter<TSchema>): Promise<WithId<TSchema> | null> {
    return this.collection.findOne(filter);
  }

  async updateOne(filter: Filter<TSchema>, update: UpdateFilter<TSchema>) {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<TSchema>) {
    return this.collection.deleteOne(filter);
  }
}

export class Database {
  private client: MongoClient;
  private _db: Db;

  constructor(dbName = "forest-game") {
    this.client = new MongoClient(MONGODB_URI);
    this._db = this.client.db(dbName);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  get db(): Db {
    return this._db;
  }

  games(): Repository<Game> {
    return new Repository<Game>(this._db.collection<Game>("games"));
  }

  users(): Repository<User> {
    return new Repository<User>(this._db.collection<User>("users"));
  }

  magicTokens(): Repository<MagicToken> {
    return new Repository<MagicToken>(
      this._db.collection<MagicToken>("magic_tokens"),
    );
  }

  sessions(): Repository<Session> {
    return new Repository<Session>(this._db.collection<Session>("sessions"));
  }
}
