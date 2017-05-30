import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class SearchProviderCollection extends MongoCollection {
  private searchProviders: Collection;

  protected async setup(context: Context) {
    this.searchProviders = mongoDatabase.db.collection('searchProviders');
    await this.searchProviders.createIndex({ id: 1 }, { unique: true });
    await this.searchProviders.createIndex({ state: 1, id: 1 });
  }

  async upsertRecord(context: Context, id: string, serviceUrl: string, secret: string): Promise<SearchProvider> {
    const record: SearchProvider = {
      id: id,
      serviceUrl: serviceUrl,
      secret: secret,
      state: 'active',
      added: clock.now()
    };
    await this.searchProviders.update({ id: id }, record, { upsert: true });
    return record;
  }

  async findById(context: Context, id: string): Promise<SearchProvider> {
    return await this.searchProviders.findOne({
      id: id.toLowerCase()
    });
  }

  async listAllActive(context: Context): Promise<SearchProvider[]> {
    return await this.searchProviders.find({ state: 'active' }).sort({ id: 1 }).toArray();
  }
}

export interface SearchProvider {
  id: string; // example:  'com.hivepoint.google'
  serviceUrl: string; // to REST service supporting provider API
  state: string; // 'active'
  secret: string; // to authenticate us when we call the REST API
  added: number; // when first added
}

const searchProviders = new SearchProviderCollection();

export { searchProviders };
