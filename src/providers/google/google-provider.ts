import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { googleUsers, GoogleUser } from "../../db";
import { SearchMatch, SearchResult } from "../../interfaces/search-match";
import { utils } from "../../utils/utils";
import { SearchProviderDescriptor, ProviderUserProfile, ProviderAccountProfile } from "../../interfaces/search-provider";
import { gmailSearcher } from "./gmail-searcher";
import { GoogleSearcher } from "./google-searcher";
import { googleDriveSearcher } from "./drive-searcher";

const googleBatch = require('google-batch');
const google = googleBatch.require('googleapis');
const dateParser = require('parse-date/silent');
const addrparser = require('address-rfc2822');

const PROVIDER_ID = 'com.hivepoint.search.google';

const CLIENT_ID = '465784242367-35slo3s2c649sos2r92t9kkhkqidm8vi.apps.googleusercontent.com';
const CLIENT_SECRET = 'HcxU0DLd_Uq0fegkYq92lrme';

export class GoogleProvider implements RestServer {
  private createOauthClient(context: Context, googleUser?: GoogleUser): any {
    const OAuth2 = google.auth.OAuth2;

    const result = new OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      'http://localhost:31111/d/svc/google/callback'
    );
    if (googleUser) {
      result.setCredentials(googleUser.tokens);
    }
    return result;
  }

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleServiceProvider.bind(this), 'get', '/svc/google', true, false);
    registrar.registerHandler(context, this.handleServiceAuthRequest.bind(this), 'get', '/svc/google/auth', true, false);
    registrar.registerHandler(context, this.handleServiceAuthCallback.bind(this), 'get', '/svc/google/callback', true, false);
    registrar.registerHandler(context, this.handleUserProfile.bind(this), 'get', '/svc/google/profile', true, false);
  }

  async handleServiceProvider(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const description: SearchProviderDescriptor = {
      id: PROVIDER_ID,
      name: 'Google',
      logoSquareUrl: '/s/svcs/google/google.png',
      authUrl: '/s/svcs/google/auth',
      services: []
    };
    description.services.push(gmailSearcher.getDescriptor());
    description.services.push(googleDriveSearcher.getDescriptor());
    return new RestServiceResult(description);
  }

  async handleServiceAuthRequest(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const braidUserId = request.query.braidUserId;
    if (!braidUserId) {
      return new RestServiceResult(null, 400, "Missing token param");
    }
    const callbackUrl = request.query.callback;
    if (!callbackUrl) {
      return new RestServiceResult(null, 400, "Missing callback param");
    }
    const serviceIdString = request.query.serviceIds;
    if (!serviceIdString) {
      return new RestServiceResult(null, 400, "Missing serviceIds param");
    }
    const serviceIds = serviceIdString.split(',');
    const services: GoogleSearcher[] = [];
    const scopes: string[] = ['profile'];
    const scopedServiceIds: string[] = [];
    for (const serviceId of serviceIds) {
      switch (serviceId.trim().toLowerCase()) {
        case gmailSearcher.getDescriptor().id:
          this.addScopes(scopes, gmailSearcher.getOauthScopes());
          scopedServiceIds.push(serviceId);
          break;
        case googleDriveSearcher.getDescriptor().id:
          scopedServiceIds.push(serviceId);
          break;
        default:
          break;
      }
    }
    const oauthClient = this.createOauthClient(context);
    const url = oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: JSON.stringify({ token: braidUserId, services: scopedServiceIds, callback: callbackUrl })
    });
    return new RestServiceResult(null, null, null, url);
  }

  private addScopes(scopes: string[], add: string[]): void {
    for (const a of add) {
      if (scopes.indexOf(a) < 0) {
        scopes.push(a);
      }
    }
  }

  async handleServiceAuthCallback(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const code = request.query.code;
    if (!code) {
      return new RestServiceResult(null, 400, "Auth code is missing");
    }
    const stateString = request.query.state;
    const state = JSON.parse(stateString);
    if (!state || !state.token || !state.scopedServiceIds) {
      return new RestServiceResult(null, 400, "State information is missing");
    }
    return new Promise<RestServiceResult>((resolve, reject) => {
      const oauthClient = this.createOauthClient(context);
      oauthClient.getToken(code, (err: any, tokens: any) => {
        if (err) {
          reject(err);
        } else {
          oauthClient.setCredentials(tokens);
          const plus = google.plus('v1');
          plus.people.get({ userId: 'me', auth: oauthClient }, (profileErr: any, profile: any) => {
            if (profileErr) {
              reject(profileErr);
            } else {
              void googleUsers.upsertRecord(context, state.braidUserId, profile.id, this.getEmailFromProfile(profile), profile, tokens, state.scopedServiceIds).then(() => {
                resolve(new RestServiceResult(null, null, null, state.callback));
              });
            }
          });
        }
      });
    });
  }

  async handleUserProfile(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const braidUserId = request.query.braidUserId;
    if (!braidUserId) {
      return new RestServiceResult(null, 400, "Missing userToken and/or id parameters");
    }
    const result: ProviderUserProfile = {
      providerId: PROVIDER_ID,
      braidUserId: braidUserId,
      accounts: []
    };
    const users = await googleUsers.findByBraidUserId(context, braidUserId);
    if (users.length === 0) {
      return new RestServiceResult(null, 404, "No matching Google user");
    }
    for (const user of users) {
      const account: ProviderAccountProfile = {
        accountId: user.googleUserId,
        name: user.profile.displayName,
        accountName: this.getEmailFromProfile(user.profile),
        imageUrl: user.profile.image ? user.profile.image.url : null,
        serviceIds: user.serviceIds
      };
      result.accounts.push(account);
    }
    return result;
  }

  private getEmailFromProfile(profile: any): string {
    if (profile && profile.emails) {
      for (const email of profile.emails) {
        if (email.type === 'account') {
          return email.value;
        }
      }
    }
    if (profile && profile.emails.length > 0) {
      return profile.emails[0].value;
    }
    return null;
  }
}

const googleProvider = new GoogleProvider();

export { googleProvider };
