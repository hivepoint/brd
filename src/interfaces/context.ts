export interface Context {
  id: string;
  serverId: string;
  getConfig(key: string, defaultValue?: any): any;
  getConfigData(): any;
  finish(err?: any): Promise<void>;
}
