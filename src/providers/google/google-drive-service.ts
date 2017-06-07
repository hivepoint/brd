import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { googleUsers, GoogleUser, googleObjectCache } from "../../db";
import { utils } from "../../utils/utils";
import { GoogleService } from "./google-service";
import { ServiceDescriptor, SERVICE_URL_SUFFIXES, FeedItem, SearchResult, FeedResult } from "../../interfaces/service-provider";
import { urlManager } from "../../url-manager";
import { GoogleBatchResponse } from "./google-service";
import { ServiceHandler, ClientMessage, ClientMessageHelper } from "../../interfaces/service-provider";

import * as moment from 'moment';
import { clock } from "../../utils/clock";
import { logger } from "../../utils/logger";
import { googleProvider } from "./google-provider";
import { NewsItem } from "../../interfaces/news-feed";

const googleBatch = require('google-batch');
const google = googleBatch.require('googleapis');

const dateParser = require('parse-date/silent');
const addrparser = require('address-rfc2822');

const SERVICE_URL = '/svc/google/drive';

const MAX_NEWS_ITEMS = 12;
const MAX_SEARCH_ITEMS = 25;

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
  sharedWithMeTime: string;
  sharingUser: DriveUserProfile;
  owners: DriveUserProfile[];
  teamDriveId: string;
  lastModifyingUser: DriveUserProfile;
  shared: boolean;
  ownedByMe: boolean;
  capabilities: any;
  viewersCanCopyContent: boolean;
  writersCanShare: boolean;
  permissions: any[];
  hasAugmentedPermissions: boolean;
  folderColorRgb: string;
  originalFilename: string;
  fullFileExtensions: string;
  fileExtension: string;
  md5Checksum: string;
  size: number;
  quotaBytesUsed: number;
  headRevisionId: string;
  contentHints: {
    thumbnail: {
      image: any,
      mimeType: string;
    }
    indexableText: string;
  };
  imageMediaMetadata: {
    width: number,
    height: number;
    rotation: number;
    location: {
      latitude: number,
      longitude: number,
      altitude: number
    };
    time: string;
    // more
  };
  videoMediaMetadata: {
    width: number;
    height: number;
    durationMillis: number;
  };
  isAppAuthorized: boolean;
}

// https://developers.google.com/drive/v3/reference/teamdrives#resource

interface TeamDriveResource {
  kind: string;
  id: string;
  name: string;
  themeId: string;
  colorRgb: string;
  backgroundImageFile: {
    id: string;
    xCoordinate: number;
    yCoordinate: number;
    width: number;
  };
  backgroundImageLink: string;
  capabilities: any;
}

// https://developers.google.com/drive/v3/reference/changes#resource
interface DriveFileChange {
  kind: string;
  type: string;
  time: string;
  removed: boolean;
  fileId: string;
  file: DriveFileResource;
  teamDriveId: string;
  teamDrive: TeamDriveResource;
}

// https://developers.google.com/drive/v3/reference/files/list
interface DriveFilesListResponse {
  kind: string;
  nextPageToken: string;
  incompleteSearch: boolean;
  files: DriveFileResource[];
}

export interface DriveUserProfile {
  kind: string;
  displayName: string;
  photoLink: string;
  me: boolean;
  permissionId: string;
  emailAddress: string;
}

export interface DriveFileCardDetails {
  id: string;
  name: string;
  mimeType: string;
  description: string;
  starred: boolean;
  version: number;
  webContentLink: string;
  webViewLink: string;
  iconLink: string;
  thumbnailLink: string;
  viewedByMe: boolean;
  viewedByMeTime: number;
  createdTime: number;
  modifiedTime: number;
  modifiedByMe: boolean;
  modifiedByMeTime: number;
  sharedWithMeTime: number;
  sharingUser: DriveUserProfile;
  owners: DriveUserProfile[];
  teamDriveId: string;
  lastModifyingUser: DriveUserProfile;
  shared: boolean;
  ownedByMe: boolean;
  fileExtension: string;
  md5Checksum: string;
  size: number;
  contentHints: {
    thumbnail: {
      image: any,
      mimeType: string;
    }
    indexableText: string;
  };
  imageMediaMetadata: {
    width: number,
    height: number;
    rotation: number;
    location: {
      latitude: number,
      longitude: number,
      altitude: number
    };
    time: string;
  };
  videoMediaMetadata: {
    width: number;
    height: number;
    durationMillis: number;
  };
}

const MAX_CACHE_LIFETIME = 1000 * 60 * 60;

export class GoogleDriveService extends GoogleService {
  serviceId = 'com.hivepoint.google.drive';
  getDescriptor(context: Context): ServiceDescriptor {
    return {
      id: this.serviceId,
      name: 'Drive',
      logoSquareUrl: urlManager.getStaticUrl(context, '/svcs/google/drive.png'),
      serviceUrl: urlManager.getDynamicUrl(context, SERVICE_URL, true, true)
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
    let query: string = request.query.q;
    if (!query) {
      return new RestServiceResult(null, 400, "Search query q is missing");
    }
    try {
      query = query.split(/[\'\"]/).join(' ').trim();
      let feedItems: FeedItem[];
      feedItems = await this.handleFetchInternal(context, braidUserId, googleUserId, "name contains '" + query + "' or fullText contains '\"" + query + "\"'", null);
      if (feedItems.length === 0) {
        feedItems = await this.handleFetchInternal(context, braidUserId, googleUserId, "name contains '" + query + "' or fullText contains '" + query + "'", null);
      }
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
      return new RestServiceResult(null, 400, "braidUserId and/or id parameter is missing");
    }
    let since: number = Number(request.query.since);
    if (!since) {
      since = clock.now() - 1000 * 60 * 60 * 24;
    }
    since = Math.max(clock.now() - 1000 * 60 * 60 * 24, since);
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

  private parseFileDate(value: string): number {
    if (!value) {
      return null;
    }
    return +moment(value);
  }

  private formatFileDate(value: number): string {
    const RFC_3339 = 'YYYY-MM-DDTHH:mm:ss';
    return moment(value).utc().format(RFC_3339);
  }

  private async handleFetchInternal(context: Context, braidUserId: string, googleUserId: string, query: string, since: number = 0): Promise<FeedItem[]> {
    const googleUser = await googleUsers.findByUserAndGoogleId(context, braidUserId, googleUserId);
    if (!googleUser) {
      throw new Error("User missing or invalid");
    }
    const files = await this.performFetch(context, braidUserId, googleUser, query, since, 25);
    const result: FeedItem[] = [];
    for (const item of files) {
      const timestamp = this.parseFileDate(item.modifiedTime);
      if (!timestamp) {
        console.log("No timestamp");
      }
      if (since > 0) {
        if (timestamp > 0 && timestamp < since) {
          break;
        }
      }
      if (item.id) {
        const details = this.getDriveItemDetails(item, googleUser);
        const match: FeedItem = {
          timestamp: timestamp,
          providerId: googleProvider.PROVIDER_ID,
          serviceId: this.serviceId,
          iconUrl: '/s/svcs/google/drive.png',
          details: details,
          url: 'https://drive.google.com/open?id=' + item.id
        };
        result.push(match);
      }
    }
    return result;
  }

  private async performFetch(context: Context, braidUserId: string, googleUser: GoogleUser, query: string, since: number, maxItems: number): Promise<DriveFileResource[]> {
    const oauthClient = this.createOauthClient(context, googleUser);
    const args: any = {
      auth: oauthClient,
      pageSize: maxItems,
      orderBy: 'modifiedTime desc',
      fields: "nextPageToken, files(id, name, mimeType, description, starred, version, webContentLink, webViewLink, iconLink, thumbnailLink, viewedByMe, viewedByMeTime, createdTime, modifiedTime, modifiedByMe, modifiedByMeTime, sharedWithMeTime, sharingUser, owners, teamDriveId, lastModifyingUser, shared, ownedByMe, fileExtension, md5Checksum, size, imageMediaMetadata, videoMediaMetadata)"
    };
    let listResponse: DriveFilesListResponse;
    if (query) {
      query = query.split(/[\'\"]/).join(' ').trim();
      args.q = "name contains '" + query + "' or fullText contains '\"" + query + "\"'";
      listResponse = await this.listFiles(context, args, googleUser);
      logger.log(context, 'google-drive', 'performFetch', 'Searched(1): Listed ' + listResponse.files.length + ' files', query, since);
      if (listResponse.files.length === 0) {
        args.q = "name contains '" + query + "' or fullText contains '" + query + "'";
        listResponse = await this.listFiles(context, args, googleUser);
        logger.log(context, 'google-drive', 'performFetch', 'Searched(2): Listed ' + listResponse.files.length + ' files', query, since);
      }
    } else {
      args.q = "modifiedTime > '" + this.formatFileDate(since - 1000 * 60 * 60 * 24) + "'";
      listResponse = await this.listFiles(context, args, googleUser);
      logger.log(context, 'google-drive', 'performFetch', 'Listed ' + listResponse.files.length + ' files', query, since);
    }
    listResponse.files.sort((a, b) => {
      const t1 = this.parseFileDate(a.modifiedTime);
      const t2 = this.parseFileDate(b.modifiedTime);
      return t2 - t1;
    });
    return listResponse.files;
  }

  private async listFiles(context: Context, args: any, googleUser: GoogleUser): Promise<DriveFilesListResponse> {
    return new Promise<DriveFilesListResponse>((resolve, reject) => {
      const drive = google.drive('v3');
      drive.files.list(args, (err: any, listResponse: DriveFilesListResponse) => {
        if (err) {
          reject(err);
        } else {
          logger.log(context, 'google-drive', 'listFiles', 'Listing files ... Found ' + listResponse.files.length);
          resolve(listResponse);
        }
      });
    });
  }

  private async getFile(context: Context, fileId: string, oauthClient: any): Promise<DriveFileResource> {
    return new Promise<DriveFileResource>((resolve, reject) => {
      const drive = google.drive('v3');
      void drive.files.get({ fileId: fileId, userId: 'me', auth: oauthClient }, (err: any, response: DriveFileResource) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }

  private async execBatch(context: Context, batch: any): Promise<Array<GoogleBatchResponse<DriveFileResource>>> {
    return new Promise<Array<GoogleBatchResponse<DriveFileResource>>>((resolve, reject) => {
      batch.exec((batchError: any, getResponses: Array<GoogleBatchResponse<DriveFileResource>>) => {
        if (batchError) {
          reject(batchError);
        } else {
          resolve(getResponses);
        }
      });
    });
  }

  private getDriveItemDetails(item: any, googleUser: GoogleUser): DriveFileCardDetails {
    const result: DriveFileCardDetails = {
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      description: item.description,
      starred: item.starred,
      version: item.version,
      webContentLink: item.webContentLink,
      webViewLink: item.webViewLink,
      iconLink: item.iconLink,
      thumbnailLink: item.thumbnailLink,
      viewedByMe: item.viewedByMe,
      viewedByMeTime: this.parseFileDate(item.viewedByMeTime),
      createdTime: this.parseFileDate(item.createdTime),
      modifiedTime: this.parseFileDate(item.modifiedTime),
      modifiedByMe: item.modifiedByMe,
      modifiedByMeTime: this.parseFileDate(item.modifiedByMeTime),
      sharedWithMeTime: this.parseFileDate(item.sharedWithMeTime),
      sharingUser: item.sharingUser,
      owners: item.owners,
      teamDriveId: item.teamDriveId,
      lastModifyingUser: item.lastModifyingUser,
      shared: item.shared,
      ownedByMe: item.ownedByMe,
      fileExtension: item.fileExtension,
      md5Checksum: item.md5Checksum,
      size: item.size,
      contentHints: item.contentHints,
      imageMediaMetadata: item.imageMediaMetadata,
      videoMediaMetadata: item.videoMediaMetadata
    };
    return result;
  }

  async handleClientCardMessage(context: Context, message: ClientMessage): Promise<void> {
    if (!context.user) {
      await this.deliverMessageToClient(context, ClientMessageHelper.createErrorReply(message, 'No current user'), false);
      return;
    }

    switch (message.type) {
      case 'news':
        await this.handleNewsFeedOrSearchRequest(context, message, false);
        break;
      case 'search':
        await this.handleNewsFeedOrSearchRequest(context, message, true);
        break;
      default:
        await this.deliverMessageToClient(context, ClientMessageHelper.createErrorReply(message, 'Unhandled message type'), false);
        break;
    }
  }
  async handleClientSocketClosed(context: Context): Promise<void> {
    // noop
  }

  private async handleNewsFeedOrSearchRequest(context: Context, request: ClientMessage, isSearch: boolean): Promise<void> {
    const googleUser = await googleUsers.findByUserAndGoogleId(context, context.user.id, request.accountId);
    if (!googleUser) {
      throw new Error("User missing or invalid");
    }
    const since = isSearch ? null : clock.now() - 1000 * 60 * 60 * 24 * 3;
    const query = isSearch ? request.details.q : null;
    try {
      const files = await this.performFetch(context, context.user.id, googleUser, query, since, isSearch ? MAX_SEARCH_ITEMS : MAX_NEWS_ITEMS);
      const newsItems: NewsItem[] = [];
      for (const file of files) {
        newsItems.push(this.createNewsItemForFile(context, file, isSearch));
      }
      await this.deliverMessageToClient(context, ClientMessageHelper.createReply(request, isSearch ? 'search-reply' : 'news-reply', { items: newsItems }), false);
    } catch (err) {
      await this.deliverMessageToClient(context, ClientMessageHelper.createErrorReply(request, 'Drive API failure'), false);
    }
  }

  private createNewsItemForFile(context: Context, file: DriveFileResource, isSearch: boolean): NewsItem {
    const result: NewsItem = {
      iconUrl: '/s/svcs/google/drive.png',
      timestamp: this.parseFileDate(file.modifiedTime),
      title: file.name,
      subtitle: (file.createdTime === file.modifiedTime ? 'Created' : (isSearch ? 'Last updated' : 'Updated')) + ' by ' + (file.modifiedByMe ? 'me' : file.lastModifyingUser.displayName),
      users: []
    };
    if (file.hasThumbnail && file.thumbnailLink) {
      result.imageUrl = file.thumbnailLink;
    }
    if (file.lastModifyingUser && !file.modifiedByMe) {
      result.users.push({ title: file.createdTime === file.modifiedTime ? 'Creator' : 'Editor', name: file.lastModifyingUser.displayName, imageUrl: file.lastModifyingUser.photoLink });
    }
    if (!file.ownedByMe && file.owners.length > 0) {
      result.users.push({ title: 'Owner', name: file.owners[0].displayName, imageUrl: file.owners[0].photoLink });
    }
    if (file.webViewLink) {
      result.sourceLink = file.webViewLink;
    }
    return result;
  }

}

const googleDriveService = new GoogleDriveService();

export { googleDriveService };
