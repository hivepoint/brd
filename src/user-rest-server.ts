import { RestServer, RestServiceRegistrar, RestServiceResult } from './interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from './interfaces/context';
import url = require('url');
import { v4 as uuid } from 'node-uuid';
import { clock } from "./utils/clock";
import { userManager } from "./user-manager";
import { searchManager } from "./search-manager";
import { providerAccounts } from "./db";
import { ProviderAccountProfile } from "./interfaces/search-provider";
import { urlManager } from "./url-manager";

export class UserRestServer implements RestServer {
  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleProviderAuthRequest.bind(this), 'get', '/user/svc/auth', true, false);
    registrar.registerHandler(context, this.handleProviderAuthCallback.bind(this), 'get', '/user/svc/auth/callback', true, false);
  }

  async handleProviderAuthRequest(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    // User wants to initiate (or re-initiate) an authentication for a search service provider
    // They will list the subset of services provided by that provider that they would like to
    // authorize.
    const providerId = request.query.providerId;
    if (!providerId) {
      return new RestServiceResult(null, 400, "providerId param missing");
    }
    const provider = searchManager.getProviderDescriptorById(providerId);
    if (!provider) {
      return new RestServiceResult(null, 404, "No such provider");
    }
    const serviceIdString = request.query.serviceIds;
    let serviceIds: string[] = [];
    if (serviceIdString) {
      serviceIds = serviceIdString.split(/\s+\,\s+/);
    }
    const userCallbackUrl = request.query.callback;
    if (!userCallbackUrl) {
      return new RestServiceResult(null, 400, "callback param missing");
    }
    const user = await userManager.getOrCreateUser(context, request, response);
    const callbackUrl = urlManager.getDynamicUrl(context, "/user/svc/auth/callback?braidUserId=" + encodeURIComponent(user.id) + "&providerId=" + encodeURIComponent(provider.id) + "&callback=" + encodeURIComponent(userCallbackUrl), true);
    const redirectUri = provider.authUrl + (provider.authUrl.indexOf('?') < 0 ? '?' : '&') + 'braidUserId=' + encodeURIComponent(user.id) + '&serviceIds=' + encodeURIComponent(serviceIds.join(',')) + '&callback=' + encodeURIComponent(callbackUrl);
    return new RestServiceResult(null, null, null, redirectUri);
  }

  async handleProviderAuthCallback(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    // After completing the auth for a search service, the user will have been redirected to here
    // The URL should include a token that we use to link this back to the same user.
    // In addition, the callback will include a param to tell us the provider-specific account ID
    // which may be a new account, or could be one we've previous authenticated with, in which case
    // we'll be updating our records accordingly
    const braidUserId = request.query.braidUserId;
    const providerId = request.query.providerId;
    const accountId = request.query.accountId;
    const userCallbackUrl = request.query.callback;
    if (!braidUserId || !providerId || !accountId || !userCallbackUrl) {
      return new RestServiceResult(null, 400, "Missing braidUserId, providerId, accountId and/or callback params");
    }
    const provider = searchManager.getProviderDescriptorById(providerId);
    if (!provider) {
      return new RestServiceResult(null, 404, "No such provider");
    }
    const profile = await searchManager.fetchUserProfile(context, provider, braidUserId);
    if (!profile) {
      return new RestServiceResult(null, 503, "Profile is missing from search provider");
    }
    let matchingAccount: ProviderAccountProfile;
    for (const account of profile.accounts) {
      if (account.accountId === accountId) {
        matchingAccount = account;
        break;
      }
    }
    if (!matchingAccount) {
      return new RestServiceResult(null, 503, "Profile account is missing from search provider");
    }
    await providerAccounts.upsertRecord(context, braidUserId, providerId, matchingAccount, 'active');
    return new RestServiceResult(null, null, null, userCallbackUrl);
  }
}

const userRestServer = new UserRestServer();

export { userRestServer };
