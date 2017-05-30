import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';
import { SearchResult, SearchMatch } from "../interfaces/search-match";

export class ServiceSearchMatchesCollection extends MongoCollection {
  private serviceSearchMatches: Collection;

  protected async setup(context: Context) {
    this.serviceSearchMatches = mongoDatabase.db.collection('serviceSearchMatches');
    await this.serviceSearchMatches.createIndex({ searchId: 1, providerId: 1, serviceId: 1 }, { unique: true });
  }

  async insertRecord(context: Context, searchId: string, providerId: string, serviceId: string, results: SearchMatch[]): Promise<ServiceSearchMatches> {
    const record: ServiceSearchMatches = {
      searchId: searchId,
      providerId: providerId,
      serviceId: serviceId,
      results: results,
      created: clock.now()
    };
    await this.serviceSearchMatches.insert(record);
    return record;
  }

  async findById(context: Context, searchId: string, providerId: string, serviceId: string): Promise<ServiceSearchMatches> {
    return await this.serviceSearchMatches.findOne({
      searchId: searchId,
      providerId: providerId,
      serviceId: serviceId
    });
  }
}

export interface ServiceSearchMatches {
  searchId: string;
  providerId: string;
  serviceId: string;
  results: SearchMatch[];
  created: number;
}

const serviceSearchMatches = new ServiceSearchMatchesCollection();

export { serviceSearchMatches };
