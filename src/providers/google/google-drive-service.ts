import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { googleUsers, GoogleUser } from "../../db";
import { utils } from "../../utils/utils";
import { GoogleService } from "./google-service";
import { ServiceDescriptor, SERVICE_URL_SUFFIXES, FeedItem, SearchResult, FeedResult } from "../../interfaces/service-provider";
import { urlManager } from "../../url-manager";
const googleBatch = require('google-batch');
const google = googleBatch.require('googleapis');
const dateParser = require('parse-date/silent');
const addrparser = require('address-rfc2822');

const SERVICE_URL = '/svc/google/drive';
const SERVICE_ID = 'com.hivepoint.google.drive';

// https://developers.google.com/drive/v3/reference/files#resource
interface DriveFileResource {
  kind: string;
  id: string;
  name: string;
  mimeType: string;
  description: string;
  starred: boolean;
  trashed: boolean;
  explicitlyTrashed: boolean;
  trashingUser: {
    kind: string;
    displayName: string;
    photoLink: string;
    me: boolean;
    permissionId: string;
    emailAddress: string;
  };
  trashedTime: string;
  parents: string[];
  properties: { [key: string]: string };
  appProperties: { [key: string]: string };
  spaces: string[];
  version: number;
  webContentLink: string;
  webViewLink: string;
}

// https://developers.google.com/drive/v3/reference/files/list
interface DriveFilesListResponse {
  kind: string;
  nextPageToken: string;
  incompleteSearch: boolean;
  files: DriveFileResource[];
}

export interface DriveFileCardDetails {
  id: string;
  name: string;
  mimeType: string;
  description: string;
  starred: boolean;
  trashed: boolean;
  trashingUser: {
    kind: string;
    displayName: string;
    photoLink: string;
    me: boolean;
    permissionId: string;
    emailAddress: string;
  };
  trashedTime: string;
  version: number;
  webContentLink: string;
  webViewLink: string;
  iconLink: string;
  hasThumbnail: boolean;
  thumbnailLink: string;
  thumbnailVersion: number;
  viewedByMe: boolean;
  viewedByMeTime: string;
  createdTime: string;
  modifiedTime: string;
  modifiedByMe: boolean;
  modifiedByMeTime: string;
}
export class GoogleDriveService extends GoogleService {

  getDescriptor(context: Context): ServiceDescriptor {
    return {
      id: SERVICE_ID,
      name: 'Drive',
      logoSquareUrl: urlManager.getStaticUrl(context, '/svcs/google/drive.png'),
      serviceUrl: urlManager.getDynamicUrl(context, SERVICE_URL, true)
    };
  }

  getOauthScopes(): string[] {
    return ['https://www.googleapis.com/auth/drive.readonly'];
  }

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    registrar.registerHandler(context, this.handleSearch.bind(this), 'get', SERVICE_URL + SERVICE_URL_SUFFIXES.search, true, false);
    registrar.registerHandler(context, this.handleFeed.bind(this), 'get', SERVICE_URL + SERVICE_URL_SUFFIXES.feed, true, false);
  }

  async handleSearch(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const braidUserId = request.query.braidUserId;
    const googleUserId = request.query.accountId;
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
      }, (err: any, listResponse: DriveFilesListResponse) => {
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
                const match: FeedItem = {
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

  async handleFeed(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    // const braidUserId = request.query.braidUserId;
    // const googleUserId = request.query.accountId;
    // if (!braidUserId || !googleUserId) {
    //   return new RestServiceResult(null, 400, "braidUserId and/or id parameter is missing");
    // }
    // const since = request.query.since;
    // if (!since) {
    //   return new RestServiceResult(null, 400, "since param is missing");
    // }
    // const googleUser = await googleUsers.findByUserAndGoogleId(context, braidUserId, googleUserId);
    // if (!googleUser) {
    //   return new RestServiceResult(null, 401, "User is missing or invalid");
    // }
    // return new Promise<RestServiceResult>((resolve, reject) => {
    //   const oauthClient = this.createOauthClient(context, googleUser);
    //   const drive = google.drive('v3');
    //   drive.files.list({
    //     auth: oauthClient,
    //     pageSize: 100,
    //     orderBy: 'modifiedTime desc'
    //   }, (err: any, listResponse: DriveFilesListResponse) => {
    //     if (err) {
    //       reject(err);
    //     } else {
    //       const feedResult: FeedResult = {
    //         items: []
    //       };
    //       if (listResponse.files) {
    //         for (const item of listResponse.files) {
    //           if (item.id) {
    //             const details = this.getDriveItemDetails(item, googleUser);
    //             const item: FeedItem = {
    //               providerId: this.PROVIDER_ID,
    //               serviceId: SERVICE_ID,
    //               iconUrl: '/s/svcs/google/drive.png',
    //               details: details,
    //               url: 'https://drive.google.com/open?id=' + item.id
    //             };
    //             searchResult.matches.push(match);
    //           }
    //         }
    //       }
    //       resolve(new RestServiceResult(searchResult));
    //     }
    //   });
    // });
    return null;
  }

}

const googleDriveService = new GoogleDriveService();

export { googleDriveService };
