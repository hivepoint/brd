import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { googleUsers, GoogleUser } from "../../db";
import { SearchMatch, SearchResult } from "../../interfaces/search-match";
import { utils } from "../../utils/utils";
import { SearchServiceDescriptor } from "../../interfaces/search-provider";
import { GoogleSearcher } from "./google-searcher";
const googleBatch = require('google-batch');
const google = googleBatch.require('googleapis');
const dateParser = require('parse-date/silent');
const addrparser = require('address-rfc2822');

interface EmailAddress {
  name?: string;
  address: string;
}

interface GmailMatchDetails {
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

const SEARCH_URL = '/svc/google/search/gmail';
const SERVICE_ID = 'com.hivepoint.search.google.gmail';
export class GmailSearcher extends GoogleSearcher {

  getDescriptor(): SearchServiceDescriptor {
    return {
      id: SERVICE_ID,
      name: 'Gmail',
      logoSquareUrl: '/s/svcs/google/gmail.png',
      searchUrl: '/d' + SEARCH_URL
    };
  }

  getOauthScopes(): string[] {
    return ['https://www.googleapis.com/auth/gmail.readonly'];
  }

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleSearch.bind(this), 'get', SEARCH_URL, true, false);
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
    const googleUser = await googleUsers.findByUserAndGoogleId(context, braidUserId, googleUserId);
    if (!googleUser) {
      return new RestServiceResult(null, 401, "User is missing or invalid");
    }
    return new Promise<RestServiceResult>((resolve, reject) => {
      const oauthClient = this.createOauthClient(context, googleUser);
      const gmail = google.gmail('v1');
      gmail.users.messages.list({
        auth: oauthClient,
        userId: 'me',
        q: query,
        maxResults: 25
      }, (err: any, listResponse: any) => {
        if (err) {
          reject(err);
        } else {
          const batch = new googleBatch();
          batch.setAuth(oauthClient);
          for (const message of listResponse.messages) {
            batch.add(gmail.users.messages.get({ id: message.id, userId: 'me', auth: oauthClient }));
          }
          batch.exec((batchError: any, getResponses: any[]) => {
            if (batchError) {
              reject(batchError);
            } else {
              const searchResult: SearchResult = {
                matches: []
              };
              for (const item of getResponses) {
                if (item.body && item.body.id) {
                  const details = this.getEmailDetails(item, googleUser);
                  const match: SearchMatch = {
                    providerId: this.PROVIDER_ID,
                    serviceId: SERVICE_ID,
                    iconUrl: '/s/svcs/google/msg.png',
                    details: details,
                    url: this.getEmailUrl(item, googleUser)
                  };
                  searchResult.matches.push(match);
                }
              }
              resolve(new RestServiceResult(searchResult));
            }
          });
        }
      });
    });
  }

  private getEmailSubject(item: any): string {
    if (item && item.body && item.body.payload && item.body.payload.headers) {
      for (const header of item.body.payload.headers) {
        if (header.name && header.name.toLowerCase() === 'subject') {
          return header.value;
        }
      }
    }
    return null;
  }

  private getEmailDetails(item: any, googleUser: GoogleUser): GmailMatchDetails {
    const fromAddresses = this.getEmailAddressesFromHeader(item, 'From');
    const result: GmailMatchDetails = {
      emailAddress: googleUser.emailAddress,
      type: 'email-message',
      id: item.body ? item.body.id : null,
      thread: item.body && item.body.payload ? item.body.payload.theadId : null,
      labels: item.body.labelIds,
      size: item.body ? item.body.sizeEstimate : null,
      snippet: item.body ? item.body.snippet : null,
      date: this.getEmailDate(item),
      subject: this.getEmailSubject(item),
      from: fromAddresses.length > 0 ? fromAddresses[0] : null,
      to: this.getEmailAddressesFromHeader(item, 'To'),
      cc: this.getEmailAddressesFromHeader(item, 'Cc'),
    };
    return result;
  }

  private getEmailAddressesFromHeader(item: any, header: string): EmailAddress[] {
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

  private getEmailHeader(item: any, headerName: string): string {
    if (item && item.body && item.body.payload && item.body.payload.headers) {
      for (const header of item.body.payload.headers) {
        if (header.name && header.name.toLowerCase() === headerName.toLowerCase()) {
          return header.value;
        }
      }
    }
    return null;
  }

  private getEmailUrl(item: any, googleUser: GoogleUser): string {
    if (item && item.body && item.body.threadId) {
      return 'https://mail.google.com/mail/?authuser=' + googleUser.emailAddress + '#all/' + item.body.threadId;
    }
    return null;
  }

  private getEmailDate(item: any): number {
    if (item && item.body && item.body.payload && item.body.payload.headers) {
      for (const header of item.body.payload.headers) {
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

const gmailSearcher = new GmailSearcher();

export { gmailSearcher };
