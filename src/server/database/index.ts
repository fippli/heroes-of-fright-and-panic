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

// Narrow environment variable to a definite string
const MONGODB_URI: string = (() => {
  const v = process.env.MONGODB_URI;
  if (!v) throw new Error("MONGODB_URI is not set");
  return v;
})();

// Your entity should be a Document
export interface Game extends Document {
  _id?: ObjectId; // optional when creating; will be required on reads via WithId<T>
  createdAt: Date;
  updatedAt: Date;
  board: {
    tiles: Tile[];
  };
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
}
