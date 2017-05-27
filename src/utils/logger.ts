import { utils } from './utils';
import { Context } from "../interfaces/context";
import { clock } from "../utils/clock";
require("console-stamp")(console, {
  pattern: "dd/mm/yyyy HH:MM:ss.l"
});
export interface LoggerEmailHandler {
  send(context: Context, fromName: string, fromEmail: string, toName: string, toEmail: string, subject: string, text: string, html: string): Promise<void>;
}

export class Logger {
  emailHandler: LoggerEmailHandler;
  pendingErrors: any[] = [];
  lastErrorEmail: number = 0;

  registerEmailHandler(handler: LoggerEmailHandler): void {
    this.emailHandler = handler;
  }

  debug(context: Context, moduleName: string, method: string, message: string, ...extras: any[]) {
    this._log(context, 'debug', moduleName, method, message, null, extras);
  }

  log(context: Context, moduleName: string, method: string, message: string, ...extras: any[]) {
    console.log(this.createMessage(context, moduleName, method, message, null), this.processExtras(extras));
    this._log(context, 'info', moduleName, method, message, null, extras);
  }

  logWithFlag(context: Context, moduleName: string, method: string, message: string, flag: string, ...extras: any[]) {
    console.log(this.createMessage(context, moduleName, method, message, null), this.processExtras(extras));
    this._log(context, 'info', moduleName, method, message, flag, extras);
  }

  warn(context: Context, moduleName: string, method: string, message: string, ...extras: any[]) {
    console.warn(this.createMessage(context, moduleName, method, message, null), this.processExtras(extras));
    this._log(context, 'warn', moduleName, method, message, null, extras);
  }

  error(context: Context, moduleName: string, method: string, message: string, ...extras: any[]) {
    const msg = this.createMessage(context, moduleName, method, message, null);
    console.error(msg, this.processExtras(extras));
    this._log(context, 'error', moduleName, method, message, null, extras);
    const errorEmail = context.getConfig('logger.errorEmail');
    if (errorEmail && errorEmail.length > 0) {
      this.pendingErrors.push(new Date(clock.now()).toString() + ": " + msg);
      if (!this.lastErrorEmail || clock.now() - this.lastErrorEmail > 1000 * 60 * 60) {
        this.lastErrorEmail = clock.now();
        if (this.emailHandler) {
          const body = "ERROR logged on server " + context.getConfig('serverId') + "\n" + this.pendingErrors.join("\n");
          void this.emailHandler.send(context, "Braid", "braid@" + context.getConfig('domain'), null, errorEmail, "Braid ERROR logged (" + this.pendingErrors.length + ")", body, null);
          console.log("Error email sent to " + errorEmail);
          this.pendingErrors = [];
        }
      }
    }
  }

  private processExtras(extras: any[]): any {
    const result: any[] = [];
    for (const extra of extras) {
      if (extra || typeof extra !== 'undefined') {
        if (extra && typeof extra === 'object' && extra.toJSON) {
          result.push(JSON.stringify(extra.toJSON()));
        } else if (typeof extra === 'object') {
          result.push(JSON.stringify(extra));
        } else {
          result.push(extra);
        }
      } else {
        result.push('');
      }
    }
    if (result.length > 0) {
      return result;
    } else {
      return '';
    }
  }

  private createMessage(context: Context, moduleName: string, method: string, msg: string, flag: string): string {
    let message = "";
    if (context) {
      message += utils.truncate(context.id, 8, true) + ' ';
    }
    if (moduleName) {
      message += moduleName;
    }
    if (method) {
      message += '.' + method;
    }
    if (msg) {
      message += ' ' + msg;
    }
    if (flag) {
      message += ' flag:' + flag;
    }

    return message.split('%').join('%%');
  }

  private _log(context: Context, severity: string, moduleName: string, method: string, message: string, flag: string, ...extras: any[]) {
    // noop
  }

}

const logger = new Logger();
export { logger }
