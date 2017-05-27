import { Context } from '../interfaces/context';
import { mongoDatabase } from './mongo-database';

export abstract class MongoCollection {
  private initialized = false;

  async ensureOpen(context: Context) {
    await mongoDatabase.ensureOpen(context);
    if (!this.initialized) {
      this.initialized = true;
      await this.setup(context);
    }
  }
  protected async abstract setup(context: Context): Promise<void>;
}
