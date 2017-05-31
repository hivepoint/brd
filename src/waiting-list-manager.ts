import { logger } from './utils/logger';
import { waitingList } from './db';
import { RestServer, RestServiceRegistrar, RestServiceResult } from './interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from './interfaces/context';
import { emailManager } from './email-manager';

export class WaitingListManager implements RestServer {
  private emailRegex = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleRegistrationRequest.bind(this), 'post', '/waitingList', true, false);
  }

  async handleRegistrationRequest(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const email = request.body.email || request.query.email;
    logger.log(context, "waiting-list", "handleRegistrationRequest", "Received waiting list registration request", email);
    if (!email || email.length === 0) {
      return new RestServiceResult(null, 400, 'An email address must be provided.');
    } else if (!this.emailRegex.test(email)) {
      return new RestServiceResult(null, 400, 'This is not a valid email address.');
    }
    const record = await waitingList.findWaitingList(context, email);
    if (record) {
      return new RestServiceResult(null, 409, 'This email address has already been registered.');
    }
    await waitingList.upsertWaitingList(context, email);
    // const toEmail = context.getConfig('waitingList.email') || "waitinglist@trykai.emailchannels.us";
    // let messageBody = 'New entry on the waiting list\n';
    // messageBody += 'Domain: ' + context.getConfig('domain') + '\n';
    // messageBody += 'Server: ' + context.getConfig('serverId') + '\n';
    // messageBody += 'Email: ' + email + '\n';
    // await emailManager.send(context, "Braid", "braid@" + context.getConfig('domain'), "Braid Waiting List", toEmail, "New WaitingList entry", messageBody, null);
    logger.log(context, "waiting-list", "handleRegistrationRequest", "Email " + email + " added to waiting list");
    return new RestServiceResult({ result: 'ok' }, 200);
  }
}

const waitingListManager = new WaitingListManager();

export { waitingListManager };
