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

  async upsertRecord(context: Context, id: string, serviceName: string, providerId: string, logoUrl: string, searchUrl: string, secret: string): Promise<SearchService> {
    const record: SearchService = {
      id: id,
      serviceName: serviceName,
      providerId: providerId,
      logoUrl: logoUrl,
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
  id: string; // example:  'com.hivepoint.google.gmail'
  serviceName: string; // example: 'Gmail'
  providerId: string; // example 'com.hivepoint.google'
  logoUrl: string; // example 64x64 gmail icon
  searchUrl: string; // URL supporting search REST service
  secret: string; // secret to pass to REST service
  state: string; // 'active', 'error', etc.
  added: number; // when first added

}

const searchServices = new SearchServiceCollection();

export { searchServices };
