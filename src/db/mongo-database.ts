
import { Context } from '../interfaces/context';
import { MongoClient } from 'mongodb';
import { Db } from 'mongodb';

export class MongoDatabase {
  db: Db;

  async ensureOpen(context: Context) {
    if (!this.db) {
      const serverOptions = context.getConfig('mongo.serverOptions');
      const options: any = { db: { w: 1 } };
      if (serverOptions) {
        options.server = serverOptions;
      }
      this.db = await MongoClient.connect(context.getConfig('mongo.mongoUrl', options));
    }
  }
}

const mongoDatabase = new MongoDatabase();

export { mongoDatabase };
