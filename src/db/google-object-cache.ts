import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class GoogleObjectCacheCollection extends MongoCollection {
  private googleObjectCache: Collection;

  protected async setup(context: Context) {
    this.googleObjectCache = mongoDatabase.db.collection('googleObjectCache');
    await this.googleObjectCache.createIndex({ braidUserId: 1, googleUserId: 1, objectType: 1, objectId: 1 }, { unique: true });
    await this.googleObjectCache.createIndex({ at: -1 });
  }

  async upsertRecord(context: Context, braidUserId: string, googleUserId: string, objectType: string, objectId: string, details: any): Promise<GoogleObjectCacheItem> {
    const record: GoogleObjectCacheItem = {
      braidUserId: braidUserId,
      googleUserId: googleUserId,
      objectType: objectType,
      objectId: objectId,
      details: details,
      at: clock.now()
    };
    await this.googleObjectCache.update({ braidUserId: braidUserId, googleUserId: googleUserId, objectType: objectType, objectId: objectId }, record, { upsert: true });
    return record;
  }

  async findItem(context: Context, braidUserId: string, googleUserId: string, objectType: string, objectId: string): Promise<GoogleObjectCacheItem[]> {
    return await this.googleObjectCache.findOne({
      braidUserId: braidUserId,
      googleUserId: googleUserId,
      objectType: objectType,
      objectId: objectId,
    });
  }

  async findItems(context: Context, braidUserId: string, googleUserId: string, objectType: string, objectIds: string[]): Promise<GoogleObjectCacheItem[]> {
    return await this.googleObjectCache.find({
      braidUserId: braidUserId,
      googleUserId: googleUserId,
      objectType: objectType,
      objectId: { $in: objectIds }
    }).toArray();
  }

  async removeBefore(context: Context, before: number): Promise<void> {
    await this.googleObjectCache.deleteMany({ at: { $lt: before } });
  }
}

export interface GoogleObjectCacheItem {
  braidUserId: string;
  googleUserId: string;
  objectType: string;
  objectId: string;
  details: any;
  at: number;
}

const googleObjectCache = new GoogleObjectCacheCollection();

export { googleObjectCache };
