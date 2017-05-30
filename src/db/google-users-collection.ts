import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class GoogleUsersCollection extends MongoCollection {
  private googleUsers: Collection;

  protected async setup(context: Context) {
    this.googleUsers = mongoDatabase.db.collection('googleUsers');
    await this.googleUsers.createIndex({ braidUserId: 1, googleUserId: 1 }, { unique: true });
  }

  async upsertRecord(context: Context, braidUserId: string, googleUserId: string, emailAddress: string, profile: any, tokens: any, serviceIds: string[]): Promise<GoogleUser> {
    const record: GoogleUser = {
      braidUserId: braidUserId,
      googleUserId: googleUserId,
      emailAddress: emailAddress,
      serviceIds: serviceIds,
      profile: profile,
      tokens: tokens,
      lastUpdated: clock.now()
    };
    await this.googleUsers.update({ braidUserId: braidUserId, googleUserId: googleUserId }, record, { upsert: true });
    return record;
  }

  async findByBraidUserId(context: Context, braidUserId: string): Promise<GoogleUser[]> {
    return await this.googleUsers.find({
      braidUserId: braidUserId
    }).sort({ googleUserId: 1 }).toArray();
  }

  async findByUserAndGoogleId(context: Context, braidUserId: string, googleUserId: string): Promise<GoogleUser> {
    return await this.googleUsers.findOne({
      braidUserId: braidUserId,
      googleUserId: googleUserId
    });
  }
}

export interface GoogleUser {
  braidUserId: string;
  googleUserId: string;
  emailAddress: string;
  serviceIds: string[];
  profile: any;
  tokens: any;
  lastUpdated: number;
}

const googleUsers = new GoogleUsersCollection();

export { googleUsers };
