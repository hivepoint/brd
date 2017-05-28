import { Context } from '../interfaces/context';
import { Collection } from 'mongodb';
import { MongoCollection } from './mongo-collection';
import { mongoDatabase } from './mongo-database';
import { clock } from '../utils/clock';

export class UserServiceCollection extends MongoCollection {
  private userServices: Collection;

  protected async setup(context: Context) {
    this.userServices = mongoDatabase.db.collection('userServices');
    await this.userServices.createIndex({ userId: 1, serviceId: 1 }, { unique: true });
    await this.userServices.createIndex({ authorizationToken: 1 }, { unique: true });
    await this.userServices.createIndex({ userId: 1, state: 1 });
  }

  async upsertRecord(context: Context, userId: string, serviceId: string, authorizationToken: string, state: string, userCallbackUrl: string, initiated: number): Promise<UserService> {
    const record: UserService = {
      userId: userId,
      serviceId: serviceId,
      authorizationToken: authorizationToken,
      state: state,
      userCallbackUrl: userCallbackUrl,
      initiated: initiated
    };
    await this.userServices.update({ userId: userId, serviceId: serviceId }, record, { upsert: true });
    return record;
  }

  async findByAuthorizationToken(context: Context, token: string): Promise<UserService> {
    return await this.userServices.findOne({
      authorizationToken: token
    });
  }

  async findByUserAndService(context: Context, userId: string, serviceId: string): Promise<UserService> {
    return await this.userServices.findOne({
      userId: userId,
      serviceId: serviceId
    });
  }

  async findByUser(context: Context, userId: string, state: string): Promise<UserService[]> {
    return await this.userServices.find({
      userId: userId,
      state: state
    }).sort({ serviceId: 1 }).toArray();
  }

  async updateState(context: Context, userId: string, serviceId: string, state: string, errorMessage?: string, errorAt?: number): Promise<void> {
    const update: any = {
      state: state
    };
    if (errorMessage) {
      update.errorMessage = errorMessage;
    }
    if (errorAt) {
      update.errorAt = errorAt;
    }
    await this.userServices.update({
      userId: userId,
      serviceId: serviceId
    }, {
        $set: update
      });
  }
}

export interface UserService {
  userId: string;
  serviceId: string;
  authorizationToken: string;
  state: string;
  userCallbackUrl: string;
  initiated: number;
  lastErrorMessage?: string;
  lastErrorAt?: number;
}

const userServices = new UserServiceCollection();

export { userServices };
