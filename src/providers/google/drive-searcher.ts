import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { googleUsers, GoogleUser } from "../../db";
import { SearchMatch, SearchResult } from "../../interfaces/search-match";
import { utils } from "../../utils/utils";
import { GoogleSearcher } from "./google-searcher";
import { SearchServiceDescriptor } from "../../interfaces/search-provider";
const googleBatch = require('google-batch');
const google = googleBatch.require('googleapis');
const dateParser = require('parse-date/silent');
const addrparser = require('address-rfc2822');

const SEARCH_URL = '/svc/google/search/drive';
const SERVICE_ID = 'com.hivepoint.search.google.drive';

export class GoogleDriveSearcher extends GoogleSearcher {

  getDescriptor(): SearchServiceDescriptor {
    return {
      id: SERVICE_ID,
      name: 'Drive',
      logoSquareUrl: '/s/svcs/google/drive.png',
      searchUrl: '/d' + SEARCH_URL
    };
  }

  getOauthScopes(): string[] {
    return ['https://www.googleapis.com/auth/drive.readonly'];
  }

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleSearch.bind(this), 'get', SEARCH_URL, true, false);
  }

  async handleSearch(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const braidUserId = request.query.braidUserId;
    const googleUserId = request.query.id;
    if (!braidUserId || !googleUserId) {
      return new RestServiceResult(null, 400, "braidUserId and/or id parameter is missing");
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
      const drive = google.drive('v3');
      drive.files.list({
        auth: oauthClient,
        q: 'fullText contains "' + query + '"',
        pageSize: 25,
        orderBy: 'modifiedTime desc'
      }, (err: any, listResponse: any) => {
        if (err) {
          reject(err);
        } else {
          const searchResult: SearchResult = {
            matches: []
          };
          if (listResponse.files) {
            for (const item of listResponse.files) {
              if (item.id) {
                const details = this.getDriveItemDetails(item, googleUser);
                const match: SearchMatch = {
                  providerId: this.PROVIDER_ID,
                  serviceId: SERVICE_ID,
                  iconUrl: '/s/svcs/google/drive.png',
                  details: details,
                  url: 'https://drive.google.com/open?id=' + item.id
                };
                searchResult.matches.push(match);
              }
            }
          }
          resolve(new RestServiceResult(searchResult));
        }
      });
    });
  }

  private getDriveItemDetails(item: any, googleUser: GoogleUser): any {
    return {
      id: item.id,
      type: item.type,
      filename: item.name,
    };
  }

}

const googleDriveSearcher = new GoogleDriveSearcher();

export { googleDriveSearcher };
