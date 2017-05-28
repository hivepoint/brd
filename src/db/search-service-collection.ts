import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class SearchServiceCollection extends MongoCollection {
  private searchServices: Collection;

  protected async setup(context: Context) {
    this.searchServices = mongoDatabase.db.collection('searchServices');
    await this.searchServices.createIndex({ id: 1 }, { unique: true });
    await this.searchServices.createIndex({ state: 1, id: 1 });
  }

  async upsertRecord(context: Context, id: string, serviceName: string, providerName: string, logoUrl: string, authUrl: string, searchUrl: string, secret: string): Promise<SearchService> {
    const record = {
      id: id,
      serviceName: serviceName,
      providerName: providerName,
      logoUrl: logoUrl,
      authUrl: authUrl,
      searchUrl: searchUrl,
      secret: secret,
      state: 'active',
      added: clock.now()
    };
    await this.searchServices.update({ id: id }, record, { upsert: true });
    return record;
  }

  async findById(context: Context, id: string): Promise<SearchService> {
    return await this.searchServices.findOne({
      id: id.toLowerCase()
    });
  }

  async listAllActive(context: Context): Promise<SearchService[]> {
    return await this.searchServices.find({ state: 'active' }).sort({ id: 1 }).toArray();
  }
}

export interface SearchService {
  id: string;
  serviceName: string;
  providerName: string;
  logoUrl: string;
  authUrl: string;
  searchUrl: string;
  secret: string;
  state: string;
  added: number;

}

const searchServices = new SearchServiceCollection();

export { searchServices };
