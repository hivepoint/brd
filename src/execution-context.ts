
import { Context } from "./interfaces/context";
import { clock } from "./utils/clock";
import { User } from "./db";
import WebSocket = require('ws');

export class ExecutionContext implements Context {
  id: string;
  user: User;
  serverId: string;
  websocket: WebSocket;
  private configData: any;
  private started: number;

  constructor(id: string, configData: any) {
    this.id = id + '-' + Math.floor(Math.random() * 1000);
    this.serverId = configData.serverId;
    this.configData = configData;
    this.started = clock.now();
  }

  getConfig(key: string, defaultValue?: any): any {
    const parts = key.split('.');
    let data = this.configData;
    for (const part of parts) {
      if (data) {
        data = data[part];
      }
    }
    if (data) {
      return data;
    } else if (typeof defaultValue !== 'undefined') {
      return defaultValue;
    } else {
      return null;
    }
  }

  getConfigData(): any {
    return this.configData;
  }
  async finish(err?: any): Promise<void> {
    // noop
  }

}
