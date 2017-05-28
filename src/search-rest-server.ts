import { RestServer, RestServiceRegistrar, RestServiceResult } from './interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from './interfaces/context';
import { searchServices, userServices, UserService, SearchService } from "./db";
import { userManager } from "./user-manager";
import { clock } from "./utils/clock";
import { logger } from "./utils/logger";
import { utils } from "./utils/utils";
const Client = require('node-rest-client').Client;

export interface SearchMatch {
  serviceId: string;
  serviceName: string;
  serviceLogoUrl: string;
  score: number;
  type: string;
  title: string;
  bodyMarkup: string;
  detailsUrl: string;
}

export interface SearchResult {
  matches: SearchMatch[];
}

export interface ServiceSearchResult {
  userId: string;
  serviceId: string;
  success: boolean;
  errorMessage?: string;
  matches: SearchMatch[];
}

export interface UserServiceListing {
  isOperational: boolean;
  lastErrorMessage?: string;
  lastErrorAt?: number;
}

export interface ServiceListing {
  service: SearchService;

  userInfo?: UserServiceListing;
}

export class SearchRestServer implements RestServer {
  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleSearchServices.bind(this), 'get', '/search/services', true, false);
    registrar.registerHandler(context, this.handleSearch.bind(this), 'post', '/search', true, false);
  }

  async handleSearchServices(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const result: ServiceListing[] = [];
    const services = await searchServices.listAllActive(context);
    for (const service of services) {
      const item: ServiceListing = {
        service: service
      };
      if (context.user) {
        const userService = await userServices.findByUserAndService(context, context.user.id, service.id);
        if (userService) {
          const userItem: UserServiceListing = {
            isOperational: userService.state === 'active',
          };
          if (!userItem.isOperational) {
            userItem.lastErrorAt = userService.lastErrorAt;
            userItem.lastErrorMessage = userService.lastErrorMessage;
          }
          item.userInfo = userItem;
        }
      }
      result.push(item);
    }
    result.sort((a, b) => {
      if (a.userInfo && !b.userInfo) {
        return -1;
      } else if (!a.userInfo && b.userInfo) {
        return 1;
      } else {
        return a.service.id.localeCompare(b.service.id);
      }
    });
    return new RestServiceResult(result);
  }

  async handleSearch(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const searchString = request.query.q;
    if (!searchString) {
      return new RestServiceResult(null, 400, "Missing search query");
    }
    const result: SearchResult = { matches: [] };
    if (context.user) {
      const searchables = await userServices.findByUser(context, context.user.id, 'active');
      if (searchables.length > 0) {
        const promises: Array<Promise<ServiceSearchResult>> = [];
        for (const searchable of searchables) {
          promises.push(this.initiateSearch(context, searchable, searchString));
        }
        const searchableResults = await Promise.all(promises);
        for (const searchableResult of searchableResults) {
          if (searchableResult.success) {
            for (const match of searchableResult.matches) {
              result.matches.push(match);
            }
          } else {
            logger.warn(context, 'search-rest', 'initiateSearch', 'Search failure on ' + searchableResult.serviceId, searchableResult.errorMessage, response);
            await userServices.updateState(context, searchableResult.userId, searchableResult.serviceId, 'error', searchableResult.errorMessage, clock.now());
          }
        }
      }
    }
    return new RestServiceResult(result);
  }

  private async initiateSearch(context: Context, searchable: UserService, searchString: string): Promise<ServiceSearchResult> {
    const service = await searchServices.findById(context, searchable.serviceId);
    if (service) {
      await userServices.updateState(context, searchable.userId, searchable.serviceId, 'internalError', 'Service is no longer available', clock.now());
    }
    return new Promise<ServiceSearchResult>((resolve, reject) => {
      if (service) {
        resolve({
          userId: searchable.userId,
          serviceId: searchable.serviceId,
          success: false,
          errorMessage: 'Service is not available',
          matches: []
        });
      } else {
        const client = new Client();
        const args = {
          parameters: { token: searchable.authorizationToken, q: searchString },
          requestConfig: {
            timeout: 30000
          },
          responseConfig: {
            timeout: 30000
          }
        };
        client.get(service.searchUrl, args, (data: ServiceSearchResult, response: Response) => {
          if (data && data.success) {
            data.userId = searchable.userId;
            data.serviceId = searchable.serviceId;
            resolve(data);
          } else {
            resolve({
              userId: searchable.userId,
              serviceId: searchable.serviceId,
              success: false,
              errorMessage: 'Service did not respond correctly',
              matches: []
            });
          }
        }).on('error', (err: any) => {
          resolve({
            userId: searchable.userId,
            serviceId: searchable.serviceId,
            success: false,
            errorMessage: 'Service invocation failure: ' + err,
            matches: []
          });
        });
      }
    });
  }
}

const searchRestServer = new SearchRestServer();

export { searchRestServer };
