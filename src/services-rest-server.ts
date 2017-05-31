import { RestServer, RestServiceRegistrar, RestServiceResult } from './interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from './interfaces/context';
import { serviceProviders, providerAccounts, ProviderAccount, serviceSearchResults, serviceSearchMatches } from "./db";
import { userManager } from "./user-manager";
import { clock } from "./utils/clock";
import { logger } from "./utils/logger";
import { utils } from "./utils/utils";
import { SearchResult } from "./interfaces/search-match";
import { ProviderAccountProfile, ServiceProviderDescriptor, ServiceDescriptor } from "./interfaces/service-provider";
import { v4 as uuid } from 'node-uuid';
import { servicesManager } from "./services-manager";
const Client = require('node-rest-client').Client;

export interface ProviderListing {
  descriptor: ServiceProviderDescriptor;

  accounts: ProviderAccount[];
}

export interface ProviderListingResponse {
  providers: ProviderListing[];
}

interface Serviceable {
  account: ProviderAccount;
  provider: ServiceProviderDescriptor;
  service: ServiceDescriptor;
}

export interface SearchRestResult {
  providerId: string;
  serviceId: string;
  pending: boolean;
  errorMessage?: string;
  searchResults?: SearchResult;
}

export interface SearchRestResponse {
  searchId: string;
  serviceResults: SearchRestResult[];
}

export class ServiceRestServer implements RestServer {

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleServices.bind(this), 'get', '/services', true, false);
    registrar.registerHandler(context, this.handleSearch.bind(this), 'post', '/search', true, false);
    registrar.registerHandler(context, this.handleSearchPoll.bind(this), 'post', '/search/poll', true, false);
  }

  async handleServices(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const result: ProviderListingResponse = { providers: [] };
    const accts = await providerAccounts.findByUser(context, context.user.id);
    for (const provider of servicesManager.getProviderDescriptors()) {
      const item: ProviderListing = {
        descriptor: provider,
        accounts: []
      };
      if (context.user) {
        for (const acct of accts) {
          if (acct.providerId === provider.id) {
            item.accounts.push(acct);
          }
        }
      }
      result.providers.push(item);
    }
    return new RestServiceResult(result);
  }

  async handleSearch(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const searchString = request.query.q;
    if (!searchString) {
      return new RestServiceResult(null, 400, "Missing search query");
    }
    const searchId = 's-' + uuid();
    const result: SearchRestResponse = { searchId: searchId, serviceResults: [] };
    if (context.user) {
      const searchables: Serviceable[] = [];
      const accts = await providerAccounts.findByUser(context, context.user.id);
      for (const acct of accts) {
        for (const provider of servicesManager.getProviderDescriptors()) {
          if (acct.providerId === provider.id) {
            for (const service of provider.services) {
              if (acct.profile.serviceIds && acct.profile.serviceIds.indexOf(service.id) >= 0) {
                searchables.push({
                  account: acct,
                  provider: provider,
                  service: service
                });
              }
            }
          }
        }
      }
      if (searchables.length > 0) {
        for (const searchable of searchables) {
          await serviceSearchResults.insertRecord(context, searchId, searchable.provider.id, searchable.service.id, true, false);
        }
        const promises: Array<Promise<void>> = [];
        for (const searchable of searchables) {
          promises.push(this.initiateService(context, searchId, searchable, searchString));
        }
        await Promise.race(promises); // Wait until at least one has completed
        return await this.handleServicePollInternal(context, searchId, request, response);
      }
    }
    return new RestServiceResult(result);
  }

  async handleSearchPoll(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const searchId = request.query.searchId;
    if (!searchId) {
      return new RestServiceResult(null, 400, "Missing searchId param");
    }
    return await this.handleServicePollInternal(context, searchId, request, response);
  }

  private async handleServicePollInternal(context: Context, searchId: string, request: Request, response: Response): Promise<RestServiceResult> {
    const result: SearchRestResponse = {
      searchId: searchId,
      serviceResults: []
    };
    const serviceResults = await serviceSearchResults.findBySearch(context, searchId);
    for (const serviceResult of serviceResults) {
      const item: SearchRestResult = {
        providerId: serviceResult.providerId,
        serviceId: serviceResult.serviceId,
        pending: serviceResult.pending,
        errorMessage: serviceResult.errorMessage
      };
      if (!serviceResult.pending && !serviceResult.delivered) {
        item.searchResults = {
          matches: []
        };
        const matchesRecord = await serviceSearchMatches.findById(context, searchId, serviceResult.providerId, serviceResult.serviceId);
        if (matchesRecord) {
          item.searchResults.matches = matchesRecord.results;
        }
        await serviceSearchResults.updateDelivered(context, searchId, serviceResult.providerId, serviceResult.serviceId, true);
      }
      result.serviceResults.push(item);
    }
    return new RestServiceResult(result);
  }

  private async initiateService(context: Context, searchId: string, searchable: Serviceable, searchString: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const client = new Client();
      const args = {
        parameters: { braidUserId: context.user.id, accountId: searchable.account.accountId, q: searchString },
        requestConfig: {
          timeout: 120000
        },
        responseConfig: {
          timeout: 120000
        }
      };
      client.get(searchable.service.searchUrl, args, (data: SearchResult, response: Response) => {
        if (data) {
          void serviceSearchMatches.insertRecord(context, searchId, searchable.provider.id, searchable.service.id, data.matches).then(() => {
            void serviceSearchResults.updateState(context, searchId, searchable.provider.id, searchable.service.id, false).then(() => {
              resolve();
            });
          });
        } else {
          void providerAccounts.updateState(context, context.user.id, searchable.provider.id, searchable.account.accountId, 'error', "No search data returned", clock.now()).then(() => {
            void serviceSearchResults.updateState(context, searchId, searchable.provider.id, searchable.service.id, false, "No search data returned").then(() => {
              resolve();
            });
          });
        }
      }).on('error', (err: any) => {
        void providerAccounts.updateState(context, context.user.id, searchable.provider.id, searchable.account.accountId, 'error', err.toString(), clock.now()).then(() => {
          void serviceSearchResults.updateState(context, searchId, searchable.provider.id, searchable.service.id, false, err.toString()).then(() => {
            resolve();
          });
        });
      });
    });
  }
}

const searchRestServer = new ServiceRestServer();

export { searchRestServer };
