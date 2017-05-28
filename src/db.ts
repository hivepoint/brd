
import { Context } from './interfaces/context';
import { Initializable } from './interfaces/initializable';

import { waitingList } from './db/waiting-list-collection';
import { searchServices } from './db/search-service-collection';
import { userServices } from './db/user-service-collection';
import { users } from './db/user-collection';

export * from './db/waiting-list-collection';
export * from './db/search-service-collection';
export * from './db/user-service-collection';
export * from './db/user-collection';

export class Database implements Initializable {
  async initialize(context: Context): Promise<void> {
    await this.initializeDatabase(context);
  }
  private async  initializeDatabase(context: Context) {
    await waitingList.ensureOpen(context);
    await searchServices.ensureOpen(context);
    await userServices.ensureOpen(context);
    await users.ensureOpen(context);
  }
}

const database = new Database();
export { database };
