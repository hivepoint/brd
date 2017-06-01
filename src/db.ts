
import { Context } from './interfaces/context';
import { Initializable } from './interfaces/initializable';

import { waitingList } from './db/waiting-list-collection';
import { serviceProviders } from './db/service-providers-collection';
import { users } from './db/user-collection';
import { providerAccounts } from './db/provider-accounts-collection';
import { serviceSearchResults } from './db/service-search-result';
import { serviceSearchMatches } from './db/service-search-matches';

import { googleUsers } from './db/google-users-collection';
import { googleObjectCache } from './db/google-object-cache';

export * from './db/waiting-list-collection';
export * from './db/service-providers-collection';
export * from './db/user-collection';
export * from './db/provider-accounts-collection';
export * from './db/service-search-result';
export * from './db/service-search-matches';

export * from './db/google-users-collection';
export * from './db/google-object-cache';

export class Database implements Initializable {
  async initialize(context: Context): Promise<void> {
    await this.initializeDatabase(context);
  }
  private async  initializeDatabase(context: Context) {
    await waitingList.ensureOpen(context);
    await serviceProviders.ensureOpen(context);
    await users.ensureOpen(context);
    await providerAccounts.ensureOpen(context);
    await serviceSearchResults.ensureOpen(context);
    await serviceSearchMatches.ensureOpen(context);

    await googleUsers.ensureOpen(context);
    await googleObjectCache.ensureOpen(context);
  }
}

const database = new Database();
export { database };
