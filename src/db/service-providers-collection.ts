import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class ServiceProvidersCollection extends MongoCollection {
  private serviceProviders: Collection;

  protected async setup(context: Context) {
    this.serviceProviders = mongoDatabase.db.collection('serviceProviders');
    await this.serviceProviders.createIndex({ id: 1 }, { unique: true });
    await this.serviceProviders.createIndex({ state: 1, id: 1 });
  }

  async upsertRecord(context: Context, id: string, serviceUrl: string): Promise<SearchProvider> {
    const record: SearchProvider = {
      id: id,
      serviceUrl: serviceUrl,
      state: 'active',
      added: clock.now()
    };
    await this.serviceProviders.update({ id: id }, record, { upsert: true });
    return record;
  }

  async findById(context: Context, id: string): Promise<SearchProvider> {
    return await this.serviceProviders.findOne({
      id: id.toLowerCase()
    });
  }

  async listAllActive(context: Context): Promise<SearchProvider[]> {
    return await this.serviceProviders.find({ state: 'active' }).sort({ id: 1 }).toArray();
  }
}

export interface SearchProvider {
  id: string; // example:  'com.hivepoint.google'
  serviceUrl: string; // to REST service supporting provider API
  state: string; // 'active'
  added: number; // when first added
}

const serviceProviders = new ServiceProvidersCollection();

export { serviceProviders };
