
import { Context } from './interfaces/context';
import { Initializable } from './interfaces/initializable';

import { waitingList } from './db/waiting-list-collection';

export * from './db/mongo-database';
export * from './db/waiting-list-collection';

export class Database implements Initializable {
  async initialize(context: Context): Promise<void> {
    await initializeDatabase(context);
  }
}

const database = new Database();
export { database };

export async function initializeDatabase(context: Context) {
  await waitingList.ensureOpen(context);
}
