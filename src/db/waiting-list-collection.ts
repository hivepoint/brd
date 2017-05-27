import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class WaitingListCollection extends MongoCollection {
  private waitingList: Collection;

  protected async setup(context: Context) {
    this.waitingList = mongoDatabase.db.collection('waitingList');
    await this.waitingList.createIndex({ emailAddress: 1 }, { unique: true });
  }

  async upsertWaitingList(context: Context, emailAddress: string) {
    const record = {
      emailAddress: emailAddress.toLowerCase(),
      added: clock.now()
    };
    await this.waitingList.update({ emailAddress: emailAddress.toLowerCase() }, record, { upsert: true });
  }

  async findWaitingList(context: Context, emailAddress: string): Promise<WaitingList> {
    return await this.waitingList.findOne({
      emailAddress: emailAddress.toLowerCase()
    });
  }
}

export interface WaitingList {
  emailAddress: string;
  added: number;
}

const waitingList = new WaitingListCollection();

export { waitingList };
