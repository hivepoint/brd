import { User } from "../db";

export interface Context {
  id: string;
  user: User;
  serverId: string;
  getConfig(key: string, defaultValue?: any): any;
  getConfigData(): any;
  finish(err?: any): Promise<void>;
}
