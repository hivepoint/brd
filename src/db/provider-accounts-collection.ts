import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';
import { ProviderAccountProfile } from "../interfaces/service-provider";

export class ProviderAccountsCollection extends MongoCollection {
  private providerAccounts: Collection;

  protected async setup(context: Context) {
    this.providerAccounts = mongoDatabase.db.collection('providerAccounts');
    await this.providerAccounts.createIndex({ braidUserId: 1, providerId: 1, accountId: 1 }, { unique: true });
  }

  async upsertRecord(context: Context, braidUserId: string, providerId: string, profile: ProviderAccountProfile, state: string): Promise<ProviderAccount> {
    const record: ProviderAccount = {
      braidUserId: braidUserId,
      providerId: providerId,
      accountId: profile.accountId,
      profile: profile,
      state: state,
      lastUpdated: clock.now()
    };
    await this.providerAccounts.update({ braidUserId: braidUserId, providerId: providerId, accountId: profile.accountId }, record, { upsert: true });
    return record;
  }

  async findByUser(context: Context, braidUserId: string): Promise<ProviderAccount[]> {
    return await this.providerAccounts.find({
      braidUserId: braidUserId
    }).toArray();
  }

  async findByUserAndProvider(context: Context, braidUserId: string, providerId: string): Promise<ProviderAccount[]> {
    return await this.providerAccounts.find({
      braidUserId: braidUserId,
      providerId: providerId
    }).toArray();
  }

  async updateState(context: Context, braidUserId: string, providerId: string, accountId: string, state: string, errorMessage?: string, errorAt?: number): Promise<void> {
    const update: any = {
      state: state
    };
    if (errorMessage) {
      update.errorMessage = errorMessage;
    }
    if (errorAt) {
      update.errorAt = errorAt;
    }
    await this.providerAccounts.update({
      braidUserId: braidUserId,
      providerId: providerId,
      accountId: accountId
    }, {
        $set: update
      });
  }

}

export interface ProviderAccount {
  braidUserId: string;
  providerId: string;
  accountId: string;
  profile: ProviderAccountProfile;
  lastUpdated: number;
  state: string;
  lastErrorMessage?: string;
  lastErrorAt?: number;

}

const providerAccounts = new ProviderAccountsCollection();

export { providerAccounts };
