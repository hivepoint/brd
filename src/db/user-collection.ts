import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class UserCollection extends MongoCollection {
  private users: Collection;

  protected async setup(context: Context) {
    this.users = mongoDatabase.db.collection('users');
    await this.users.createIndex({ id: 1 }, { unique: true });
  }

  async upsertRecord(context: Context, id: string, ): Promise<User> {
    const record: User = {
      id: id,
      created: clock.now()
    };
    await this.users.insert(record);
    return record;
  }

  async findById(context: Context, id: string): Promise<User> {
    return await this.users.findOne({
      id: id
    });
  }
}

export interface User {
  id: string;
  created: number;
}

const users = new UserCollection();

export { users };
