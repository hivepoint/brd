import { RestServer, RestServiceRegistrar, RestServiceResult } from './interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from './interfaces/context';
import { searchServices, userServices } from "./db";
import url = require('url');
import { v4 as uuid } from 'node-uuid';
import { clock } from "./utils/clock";
import { userManager } from "./user-manager";

export interface UserAuthorizedService {
  serviceId: string;
  serviceName: string;
  providerName: string;
  isOperational: boolean;
  lastErrorMessage?: string;
  lastErrorAt?: number;
}
export interface UserIdentity {
  authorizedServices: UserAuthorizedService[];
}

export class UserRestServer implements RestServer {
  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleIdentityRequest.bind(this), 'post', '/user/identity', true, false);
    registrar.registerHandler(context, this.handleServiceAuthRequest.bind(this), 'get', '/user/svc/auth/request', true, false);
    registrar.registerHandler(context, this.handleServiceAuthCallback.bind(this), 'get', '/user/svc/auth/callback', true, false);
  }

  async handleIdentityRequest(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    // User wants to know about themselves
    const result: UserIdentity = {
      authorizedServices: []
    };
    if (context.user) {
      const searchables = await userServices.findByUser(context, context.user.id, 'active');
      for (const searchable of searchables) {
        const service = await searchServices.findById(context, searchable.serviceId);
        if (service) {
          const item: UserAuthorizedService = {
            serviceId: searchable.serviceId,
            serviceName: service.serviceName,
            providerName: service.providerName,
            isOperational: service.state === 'active',
          };
          if (!item.isOperational) {
            item.lastErrorAt = searchable.lastErrorAt;
            item.lastErrorMessage = searchable.lastErrorMessage;
          }
          result.authorizedServices.push(item);
        }
      }
      result.authorizedServices.sort((a, b) => {
        return a.serviceId.localeCompare(b.serviceId);
      });
    }
    return new RestServiceResult(result);
  }

  async handleServiceAuthRequest(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    // User wants to initiate (or re-initiate) an authentication for a search service
    // Base on the service they are asking for, we will redirect them to the appropriate oauth URL, along with a
    // token that we expect to get back during the callback which will link it back to the same user
    const serviceId = request.query.service;
    if (!serviceId) {
      return new RestServiceResult(null, 400, "serviceId param missing");
    }
    const service = await searchServices.findById(context, serviceId);
    if (!service || service.state !== 'active') {
      return new RestServiceResult(null, 400, "Unknown or unavailable service");
    }
    const userCallbackUrl = request.query.callback;
    if (!userCallbackUrl) {
      return new RestServiceResult(null, 400, "callback param missing");
    }
    const user = await userManager.getOrCreateUser(context, request, response);
    const token = uuid();
    await userServices.upsertRecord(context, user.id, serviceId, token, 'pending', userCallbackUrl, clock.now());
    const callbackUrl = url.resolve(context.getConfig('baseClientUri'), "/d/user/svc/auth/callback?token=" + encodeURIComponent(token));
    const redirectUri = service.authUrl + (service.authUrl.indexOf('?') < 0 ? '?' : '&') + 'token=' + encodeURIComponent(token) + '&callbackUrl=' + encodeURIComponent(callbackUrl);
    return new RestServiceResult(null, null, null, redirectUri);
  }

  async handleServiceAuthCallback(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    // After completing the auth for a search service, the user will have been redirected to here
    // The URL should include a token that we use to link this back to the same user.
    // We then redirect the user back to an appropriate landing page.
    const token = request.query.token;
    if (!token) {
      return new RestServiceResult(null, 400, "Missing token param");
    }
    const userService = await userServices.findByAuthorizationToken(context, token);
    if (!userService || clock.now() - userService.initiated > 1000 * 60 * 60) {
      return new RestServiceResult(null, 400, "Token is invalid or has expired");
    }
    await userServices.updateState(context, userService.userId, userService.serviceId, 'active');
    return new RestServiceResult(null, null, null, userService.userCallbackUrl);
  }
}

const userRestServer = new UserRestServer();

export { userRestServer };
