import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class PivotalUsersCollection extends MongoCollection {
  private pivotalUsers: Collection;

  protected async setup(context: Context) {
    this.pivotalUsers = mongoDatabase.db.collection('pivotalUsers');
    await this.pivotalUsers.createIndex({ braidUserId: 1, pivotalUserId: 1 }, { unique: true });
  }

  async upsertRecord(context: Context, braidUserId: string, pivotalUserId: string, userName: string, apiToken: string): Promise<PivotalUser> {
    const record: PivotalUser = {
      braidUserId: braidUserId,
      pivotalUserId: pivotalUserId,
      userName: userName,
      apiToken: apiToken,
      lastUpdated: clock.now()
    };
    await this.pivotalUsers.update({ braidUserId: braidUserId, pivotalUserId: pivotalUserId }, record, { upsert: true });
    return record;
  }

  async findByBraidUserId(context: Context, braidUserId: string): Promise<PivotalUser[]> {
    return await this.pivotalUsers.find({
      braidUserId: braidUserId
    }).sort({ pivotalUserId: 1 }).toArray();
  }

  async findByUserAndPivotalId(context: Context, braidUserId: string, pivotalUserId: string): Promise<PivotalUser> {
    return await this.pivotalUsers.findOne({
      braidUserId: braidUserId,
      pivotalUserId: pivotalUserId
    });
  }

  async deleteByUserId(context: Context, braidUserId: string): Promise<void> {
    await this.pivotalUsers.deleteMany({ braidUserId: braidUserId });
  }
}

export interface PivotalUser {
  braidUserId: string;
  pivotalUserId: string;
  userName: string;
  apiToken: string;
  lastUpdated: number;
}

const pivotalUsers = new PivotalUsersCollection();

export { pivotalUsers };
