import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { googleUsers, GoogleUser } from "../../db";
import { utils } from "../../utils/utils";
import { ServiceDescriptor, SERVICE_URL_SUFFIXES, FeedItem, SearchResult, FeedResult } from "../../interfaces/service-provider";
import { GoogleService } from "./google-service";
import { urlManager } from "../../url-manager";
import { GoogleBatchResponse } from "./google-service";
import { logger } from "../../utils/logger";
const googleBatch = require('google-batch');
const google = googleBatch.require('googleapis');
const dateParser = require('parse-date/silent');
const addrparser = require('address-rfc2822');

interface EmailAddress {
  name?: string;
  address: string;
}

interface GmailMessageDetails {
  emailAddress: string;
  type: string;
  id: string;
  thread: string;
  labels: string[];
  size: number;
  snippet: string;
  date: number;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
}

const SERVICE_URL = '/svc/google/gmail';
const SERVICE_ID = 'com.hivepoint.google.gmail';

interface GmailAttachmentResource {
  attachmentId: string;
  size: number;
  data: string;  // Base64URL encoded
}

interface GmailMessageHeader {
  name: string;
  value: string;
}

// https://developers.google.com/gmail/api/v1/reference/users/messages#resource
interface GmailMessageResource {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: number;
  internalDate: number;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: GmailMessageHeader[];
    body: GmailAttachmentResource;
    parts: any[];  // child MIME message parts
  };
  sizeEstimate: number;
  raw: string;  // base64url encoded
}

// https://developers.google.com/gmail/api/v1/reference/users/messages/list
interface GmailListResponse {
  messages: GmailMessageResource[];
  nextPageToken: string;
  resultSizeEstimate: number;
}

export class GmailService extends GoogleService {

  getDescriptor(context: Context): ServiceDescriptor {
    return {
      id: SERVICE_ID,
      name: 'Gmail',
      logoSquareUrl: urlManager.getStaticUrl(context, '/svcs/google/gmail.png'),
      serviceUrl: urlManager.getDynamicUrl(context, SERVICE_URL, true)
    };
  }

  getOauthScopes(): string[] {
    return ['https://www.googleapis.com/auth/gmail.readonly'];
  }

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleSearch.bind(this), 'get', SERVICE_URL + SERVICE_URL_SUFFIXES.search, true, false);
    registrar.registerHandler(context, this.handleFeed.bind(this), 'get', SERVICE_URL + SERVICE_URL_SUFFIXES.feed, true, false);
  }

  async handleSearch(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const braidUserId = request.query.braidUserId;
    const googleUserId = request.query.accountId;
    if (!braidUserId || !googleUserId) {
      return new RestServiceResult(null, 400, "token and/or id parameter is missing");
    }
    const query = request.query.q;
    if (!query) {
      return new RestServiceResult(null, 400, "Search query q is missing");
    }
    try {
      const feedItems = await this.handleFetchInternal(context, braidUserId, googleUserId, query);
      const result: SearchResult = {
        matches: feedItems
      };
      return new RestServiceResult(result);
    } catch (err) {
      return new RestServiceResult(null, 503, err.toString());
    }
  }

  async handleFeed(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const braidUserId = request.query.braidUserId;
    const googleUserId = request.query.accountId;
    if (!braidUserId || !googleUserId) {
      return new RestServiceResult(null, 400, "token and/or id parameter is missing");
    }
    const since = request.query.since;
    if (!since) {
      return new RestServiceResult(null, 400, "search param is missing");
    }
    try {
      const feedItems = await this.handleFetchInternal(context, braidUserId, googleUserId, null, since);
      const result: FeedResult = {
        items: feedItems
      };
      return new RestServiceResult(result);
    } catch (err) {
      return new RestServiceResult(null, 503, err.toString());
    }
  }

  private async handleFetchInternal(context: Context, braidUserId: string, googleUserId: string, query: string, since = 0): Promise<FeedItem[]> {
    const googleUser = await googleUsers.findByUserAndGoogleId(context, braidUserId, googleUserId);
    if (!googleUser) {
      throw new Error("User is missing or invalid");
    }
    return new Promise<FeedItem[]>((resolve, reject) => {
      const oauthClient = this.createOauthClient(context, googleUser);
      const gmail = google.gmail('v1');
      const args: any = {
        auth: oauthClient,
        userId: 'me',
        maxResults: 50
      };
      args.q = query ? query : "newer_than:2d";
      gmail.users.messages.list(args, (err: any, listResponse: GmailListResponse) => {
        if (err) {
          reject(err);
        } else {
          if (listResponse.messages.length === 0) {
            resolve([]);
            return;
          }
          const batch = new googleBatch();
          batch.setAuth(oauthClient);
          for (const message of listResponse.messages) {
            batch.add(gmail.users.messages.get({ id: message.id, userId: 'me', auth: oauthClient }));
          }
          logger.log(context, 'gmail', 'handleFetchInternal', 'Fetching batch of ' + listResponse.messages.length + " messages");
          batch.exec((batchError: any, getResponses: Array<GoogleBatchResponse<GmailMessageResource>>) => {
            if (batchError) {
              reject(batchError);
            } else {
              const items: FeedItem[] = [];
              getResponses.sort((a, b) => {
                const t1 = this.getEmailDate(a.body);
                const t2 = this.getEmailDate(b.body);
                return t2 - t1;
              });
              for (const response of getResponses) {
                if (response.body) {
                  const timestamp = this.getEmailDate(response.body);
                  if (timestamp) {
                    if (since && timestamp < since) {
                      break;
                    }
                  }
                  const details = this.getEmailDetails(response.body, googleUser);
                  const match: FeedItem = {
                    timestamp: this.getEmailDate(response.body),
                    providerId: this.PROVIDER_ID,
                    serviceId: SERVICE_ID,
                    iconUrl: '/s/svcs/google/msg.png',
                    details: details,
                    url: this.getEmailUrl(response.body, googleUser)
                  };
                  items.push(match);
                }
              }
              resolve(items);
            }
          });
        }
      });
    });
  }

  private getEmailSubject(item: GmailMessageResource): string {
    if (item.payload && item.payload.headers) {
      for (const header of item.payload.headers) {
        if (header.name && header.name.toLowerCase() === 'subject') {
          return header.value;
        }
      }
    }
    return null;
  }

  private getEmailDetails(item: GmailMessageResource, googleUser: GoogleUser): GmailMessageDetails {
    const fromAddresses = this.getEmailAddressesFromHeader(item, 'From');
    const result: GmailMessageDetails = {
      emailAddress: googleUser.emailAddress,
      type: 'email-message',
      id: item.id,
      thread: item.threadId,
      labels: item.labelIds,
      size: item.sizeEstimate,
      snippet: item.snippet,
      date: this.getEmailDate(item),
      subject: this.getEmailSubject(item),
      from: fromAddresses.length > 0 ? fromAddresses[0] : null,
      to: this.getEmailAddressesFromHeader(item, 'To'),
      cc: this.getEmailAddressesFromHeader(item, 'Cc'),
    };
    return result;
  }

  private getEmailAddressesFromHeader(item: GmailMessageResource, header: string): EmailAddress[] {
    const result: EmailAddress[] = [];
    const value = this.getEmailHeader(item, header);
    if (!value) {
      return result;
    }
    const addresses = addrparser.parse(value);
    for (const address of addresses) {
      const a: EmailAddress = {
        name: address.name(),
        address: address.address
      };
      result.push(a);
    }
    return result;
  }

  private getEmailHeader(item: GmailMessageResource, headerName: string): string {
    if (item.payload && item.payload.headers) {
      for (const header of item.payload.headers) {
        if (header.name && header.name.toLowerCase() === headerName.toLowerCase()) {
          return header.value;
        }
      }
    }
    return null;
  }

  private getEmailUrl(item: GmailMessageResource, googleUser: GoogleUser): string {
    if (item.threadId) {
      return 'https://mail.google.com/mail/?authuser=' + googleUser.emailAddress + '#all/' + item.threadId;
    }
    return null;
  }

  private getEmailDate(item: GmailMessageResource): number {
    if (item.payload && item.payload.headers) {
      for (const header of item.payload.headers) {
        if (header.name && header.name.toLowerCase() === 'date') {
          const dateString = header.value;
          const result = dateParser(dateString);
          if (result) {
            return result.getTime();
          }
        }
      }
    }
    return null;
  }
}

const gmailService = new GmailService();

export { gmailService };
