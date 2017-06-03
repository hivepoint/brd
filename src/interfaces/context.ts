import { User } from "../db";
import WebSocket = require('ws');

export interface Context {
  id: string;
  user: User;
  websocket: WebSocket;
  serverId: string;
  getConfig(key: string, defaultValue?: any): any;
  getConfigData(): any;
  finish(err?: any): Promise<void>;
}
