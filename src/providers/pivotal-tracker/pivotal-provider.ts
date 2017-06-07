import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { utils } from "../../utils/utils";
import { ServiceProviderDescriptor, ProviderUserProfile, ProviderAccountProfile, ServiceProvider, ClientMessageDeliverer, SERVICE_URL_SUFFIXES } from "../../interfaces/service-provider";
import { Startable } from "../../interfaces/startable";
import url = require('url');
import { urlManager } from "../../url-manager";
import { logger } from "../../utils/logger";
import { serviceProviders, pivotalUsers, PivotalUser } from "../../db";
import { ServiceDescriptor, ServiceHandler, ClientMessage, ClientMessageHelper, FeedItem, FeedResult, SearchResult } from '../../interfaces/service-provider';
import { clock } from "../../utils/clock";
import { NewsItem } from "../../interfaces/news-feed";
const tracker = require('pivotaltracker');

const SERVICE_URL = '/svc/pivotal';
const AUTH_URL = SERVICE_URL + '/auth';
const AUTH_CALLBACK_URL = SERVICE_URL + '/callback';

const MAX_NEWS_ITEMS = 12;
const MAX_SEARCH_ITEMS = 25;

export class PivotalProvider implements RestServer, Startable, ServiceProvider, ServiceHandler {
  providerId = 'com.hivepoint.pivotal';
  serviceId = "com.hivepoint.pivotal.service";
  private deliverer: ClientMessageDeliverer;

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    // registrar.registerHandler(context, this.handleServiceAuthRequest.bind(this), 'get', AUTH_URL, true, false);
    // registrar.registerHandler(context, this.handleServiceAuthCallback.bind(this), 'get', AUTH_CALLBACK_URL, true, false);
    registrar.registerHandler(context, this.handleSearch.bind(this), 'get', SERVICE_URL + SERVICE_URL_SUFFIXES.search, true, false);
    registrar.registerHandler(context, this.handleFeed.bind(this), 'get', SERVICE_URL + SERVICE_URL_SUFFIXES.feed, true, false);
  }

  async start(context: Context): Promise<void> {
    await serviceProviders.upsertRecord(context, this.providerId, urlManager.getDynamicUrl(context, SERVICE_URL, true, true));
  }

  async getDescriptor(context: Context): Promise<ServiceProviderDescriptor> {
    const description: ServiceProviderDescriptor = {
      id: this.providerId,
      name: 'Pivotal Tracker',
      logoSquareUrl: urlManager.getStaticUrl(context, '/svcs/pivotal/pivotal.png'),
      authUrl: urlManager.getDynamicUrl(context, AUTH_URL, true, false),
      services: []
    };
    description.services.push(this.getServiceDescriptor(context));
    return description;
  }

  private getServiceDescriptor(context: Context): ServiceDescriptor {
    const result: ServiceDescriptor = {
      id: this.serviceId,
      name: 'Pivotal Tracker',
      logoSquareUrl: urlManager.getStaticUrl(context, '/svcs/pivotal/pivotal.png'),
      serviceUrl: urlManager.getDynamicUrl(context, SERVICE_URL, true, true)
    };
    return result;
  }

  async getUserProfile(context: Context, braidUserId: string): Promise<ProviderUserProfile> {
    const result: ProviderUserProfile = {
      providerId: this.providerId,
      braidUserId: braidUserId,
      accounts: []
    };
    const users = await pivotalUsers.findByBraidUserId(context, braidUserId);
    if (users.length === 0) {
      return null;
    }
    for (const user of users) {
      const account: ProviderAccountProfile = {
        accountId: user.pivotalUserId,
        name: user.userName,
        accountName: user.userName,
        imageUrl: null,
        serviceIds: [this.serviceId]
      };
      result.accounts.push(account);
    }
    return result;
  }

  async onUserDeleted(context: Context, braidUserId: string): Promise<void> {
    await pivotalUsers.deleteByUserId(context, braidUserId);
  }

  registerClientMessageDeliveryService(context: Context, messageDeliverer: ClientMessageDeliverer) {
    this.deliverer = messageDeliverer;
  }

  async handleSearch(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const result: SearchResult = {
      matches: []
    };
    return new RestServiceResult(result);
  }

  async handleFeed(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const braidUserId = request.query.braidUserId;
    const pivotalUserId = request.query.accountId;
    if (!braidUserId || !pivotalUserId) {
      return new RestServiceResult(null, 400, "braidUserId and/or id parameter is missing");
    }
    try {
      const activities = await this.performActivityFetch(context, braidUserId, pivotalUserId, MAX_NEWS_ITEMS);
      const result: FeedResult = {
        items: []
      };
      for (const activity of activities) {
        result.items.push(this.createFeedItemFromActivity(context, activity));
      }
      return new RestServiceResult(result);
    } catch (err) {
      return new RestServiceResult(null, 503, err.toString());
    }
  }

  async handleClientCardMessage(context: Context, message: ClientMessage): Promise<void> {
    if (!context.user) {
      await this.deliverMessageToClient(context, ClientMessageHelper.createErrorReply(message, 'No current user'), false);
      return;
    }

    switch (message.type) {
      case 'news':
        await this.handleNewsFeedRequest(context, message);
        break;
      case 'search':
        // await this.handleNewsFeedOrSearchRequest(context, message, true);
        break;
      default:
        await this.deliverMessageToClient(context, ClientMessageHelper.createErrorReply(message, 'Unhandled message type'), false);
        break;
    }
  }
  async handleClientSocketClosed(context: Context): Promise<void> {
    // noop
  }

  private async deliverMessageToClient(context: Context, message: ClientMessage, multicast: boolean): Promise<void> {
    await this.deliverer.deliverMessage(context, message, multicast);
  }

  private async handleNewsFeedRequest(context: Context, request: ClientMessage): Promise<void> {
    const pivotalUser = await pivotalUsers.findByUserAndPivotalId(context, context.user.id, request.accountId);
    if (!pivotalUser) {
      throw new Error("User missing or invalid");
    }
    try {
      const activities = await this.performActivityFetch(context, context.user.id, pivotalUser, MAX_NEWS_ITEMS);
      const newsItems: NewsItem[] = [];
      for (const activity of activities) {
        newsItems.push(this.createNewsItemForActivity(context, activity));
      }
      await this.deliverMessageToClient(context, ClientMessageHelper.createReply(request, 'news-reply', { items: newsItems }), false);
    } catch (err) {
      await this.deliverMessageToClient(context, ClientMessageHelper.createErrorReply(request, 'Drive API failure'), false);
    }
  }

  private async performActivityFetch(context: Context, braidUserId: string, pivotalUser: PivotalUser, maxItems: number): Promise<any[]> {
    return null;
  }

  private createNewsItemForActivity(context: Context, activity: any): NewsItem {
    const result: NewsItem = {
      iconUrl: '/s/svcs/pivotal/pivotal.png',
      timestamp: activity.timestamp,
      title: activity.title,
      subtitle: activity.subtitle,
      users: []
    };
    return result;
  }

  private createFeedItemFromActivity(context: Context, activity: any): FeedItem {
    const result: FeedItem = {
      timestamp: activity.timestamp,
      providerId: this.providerId,
      serviceId: this.serviceId,
      iconUrl: '/s/svcs/pivotal/pivotal.png',
      details: {}
    };
    return result;
  }

}

const pivotalProvider = new PivotalProvider();

export { pivotalProvider };
