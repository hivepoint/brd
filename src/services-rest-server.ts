import { RestServer, RestServiceRegistrar, RestServiceResult } from './interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from './interfaces/context';
import { serviceProviders, providerAccounts, ProviderAccount, serviceSearchResults, serviceSearchMatches } from "./db";
import { userManager } from "./user-manager";
import { clock } from "./utils/clock";
import { logger } from "./utils/logger";
import { utils } from "./utils/utils";
import { ProviderAccountProfile, ServiceProviderDescriptor, ServiceDescriptor, SearchResult } from "./interfaces/service-provider";
import { v4 as uuid } from 'node-uuid';
import { servicesManager } from "./services-manager";
import { RestClient } from "./utils/rest-client";

export interface ProviderListing {
  descriptor: ServiceProviderDescriptor;
  accounts: ProviderAccount[];
}

export interface ProviderListingResponse {
  providers: ProviderListing[];
}

interface Service {
  account: ProviderAccount;
  provider: ServiceProviderDescriptor;
  descriptor: ServiceDescriptor;
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

export class ServicesRestServer implements RestServer {

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleServices.bind(this), 'get', '/services', true, false);
    registrar.registerHandler(context, this.handleSearch.bind(this), 'poll', '/search', true, false);
    registrar.registerHandler(context, this.handleSearchPoll.bind(this), 'poll', '/search/poll', true, false);
  }

  async handleServices(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const result: ProviderListingResponse = { providers: [] };
    let accts: ProviderAccount[] = [];
    if (context.user) {
      accts = await providerAccounts.findByUser(context, context.user.id);
    }
    for (const provider of servicesManager.getProviderDescriptors(context, true)) {
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
    logger.log(context, 'services-rest', 'handleServices', 'Fetched services', result);
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
      logger.log(context, 'services-rest', 'handleSearch', 'Initiating search', searchId, searchString);
      const services: Service[] = [];
      const accts = await providerAccounts.findByUser(context, context.user.id);
      for (const acct of accts) {
        for (const provider of servicesManager.getProviderDescriptors(context, false)) {
          if (acct.providerId === provider.id) {
            for (const serviceDescriptor of provider.services) {
              if (acct.profile.serviceIds && acct.profile.serviceIds.indexOf(serviceDescriptor.id) >= 0) {
                services.push({
                  account: acct,
                  provider: provider,
                  descriptor: serviceDescriptor
                });
              }
            }
          }
        }
      }
      if (services.length > 0) {
        for (const service of services) {
          await serviceSearchResults.insertRecord(context, searchId, service.provider.id, service.descriptor.id, true, false);
        }
        const promises: Array<Promise<void>> = [];
        for (const service of services) {
          promises.push(this.initiateSearch(context, searchId, service, searchString));
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

  private async initiateSearch(context: Context, searchId: string, service: Service, searchString: string): Promise<void> {
    try {
      const searchResult = await RestClient.get<SearchResult>(service.descriptor.serviceUrl + '/search', { braidUserId: context.user.id, accountId: service.account.accountId, q: searchString });
      await serviceSearchMatches.insertRecord(context, searchId, service.provider.id, service.descriptor.id, searchResult.matches);
      await serviceSearchResults.updateState(context, searchId, service.provider.id, service.descriptor.id, false);
    } catch (err) {
      logger.error(context, 'services', 'loadProvider', 'Failure loading provider', utils.logErrorObject(err));
      await providerAccounts.updateState(context, context.user.id, service.provider.id, service.account.accountId, 'error', err.toString(), clock.now());
      await serviceSearchResults.updateState(context, searchId, service.provider.id, service.descriptor.id, false, err.toString());
    }
  }
}

const servicesRestServer = new ServicesRestServer();

export { servicesRestServer };
