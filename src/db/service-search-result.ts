import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class ServiceSearchResultCollection extends MongoCollection {
  private serviceSearchResults: Collection;

  protected async setup(context: Context) {
    this.serviceSearchResults = mongoDatabase.db.collection('serviceSearchResults2');
    await this.serviceSearchResults.createIndex({ searchId: 1, providerId: 1, serviceId: 1, accountId: 1 }, { unique: true });
  }

  async insertRecord(context: Context, searchId: string, providerId: string, serviceId: string, accountId: string, pending: boolean, delivered: boolean): Promise<ServiceSearchResult> {
    const record: ServiceSearchResult = {
      searchId: searchId,
      providerId: providerId,
      serviceId: serviceId,
      accountId: accountId,
      pending: pending,
      delivered: delivered,
      created: clock.now()
    };
    await this.serviceSearchResults.insert(record);
    return record;
  }

  async updateState(context: Context, searchId: string, providerId: string, serviceId: string, accountId: string, pending: boolean, errorMessage?: string): Promise<void> {
    const update: any = {
      pending: pending
    };
    if (errorMessage) {
      update.errorMessage = errorMessage;
    }
    await this.serviceSearchResults.update({
      searchId: searchId,
      providerId: providerId,
      serviceId: serviceId,
      accountId: accountId
    }, {
        $set: update
      });
  }

  async updateDelivered(context: Context, searchId: string, providerId: string, serviceId: string, accountId: string, delivered: boolean): Promise<void> {
    await this.serviceSearchResults.update({
      searchId: searchId,
      providerId: providerId,
      serviceId: serviceId,
      accountId: accountId
    }, {
        $set: { delivered: delivered }
      });
  }

  async findBySearch(context: Context, searchId: string): Promise<ServiceSearchResult[]> {
    return await this.serviceSearchResults.find({
      searchId: searchId,
    }).toArray();
  }

  async findBySearchAndServiceId(context: Context, searchId: string, providerId: string, serviceId: string, accountId: string): Promise<ServiceSearchResult> {
    return await this.serviceSearchResults.findOne({
      searchId: searchId,
      providerId: providerId,
      serviceId: serviceId,
      accountId: accountId
    });
  }
}

export interface ServiceSearchResult {
  searchId: string;
  providerId: string;
  serviceId: string;
  accountId: string;
  pending: boolean;
  delivered: boolean;
  errorMessage?: string;
  created: number;
}

const serviceSearchResults = new ServiceSearchResultCollection();

export { serviceSearchResults };
