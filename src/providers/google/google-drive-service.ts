import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { googleUsers, GoogleUser, googleObjectCache } from "../../db";
import { utils } from "../../utils/utils";
import { GoogleService } from "./google-service";
import { ServiceDescriptor, SERVICE_URL_SUFFIXES, FeedItem, SearchResult, FeedResult } from "../../interfaces/service-provider";
import { urlManager } from "../../url-manager";
import { GoogleBatchResponse } from "./google-service";

import * as moment from 'moment';
import { clock } from "../../utils/clock";
import { logger } from "../../utils/logger";
import { googleProvider } from "./google-provider";

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
    const oauthClient = this.createOauthClient(context, googleUser);
    const args: any = {
      auth: oauthClient,
      pageSize: 25,
      orderBy: 'modifiedTime desc',
      fields: "nextPageToken, files(id, name, mimeType, description, starred, version, webContentLink, webViewLink, iconLink, thumbnailLink, viewedByMe, viewedByMeTime, createdTime, modifiedTime, modifiedByMe, modifiedByMeTime, sharedWithMeTime, sharingUser, owners, teamDriveId, lastModifyingUser, shared, ownedByMe, fileExtension, md5Checksum, size, imageMediaMetadata, videoMediaMetadata)"
    };
    args.q = query ? query : "modifiedTime > '" + this.formatFileDate(since - 1000 * 60 * 60 * 24) + "'";
    const listResponse = await this.listFiles(context, args, googleUser);
    if (listResponse.files.length === 0) {
      return [];
    }

    // const ids: string[] = [];
    // for (const file of listResponse.files) {
    //   ids.push(file.id);
    // }
    // const cacheItems = await googleObjectCache.findItems(context, braidUserId, googleUserId, 'drive-file', ids);
    // const files: DriveFileResource[] = [];

    // const drive = google.drive('v3');
    // for (const file of listResponse.files) {
    //   let found = false;
    //   for (const cacheItem of cacheItems) {
    //     if (cacheItem.objectId === file.id && clock.now() - cacheItem.at < MAX_CACHE_LIFETIME) {
    //       files.push(cacheItem.details as DriveFileResource);
    //       found = true;
    //       break;
    //     }
    //   }
    //   if (!found) {
    //     const fileResource = await this.getFile(context, file.id, oauthClient);
    //     files.push(fileResource);
    //     await googleObjectCache.upsertRecord(context, braidUserId, googleUserId, 'drive-file', file.id, fileResource);
    //   }
    // }
    listResponse.files.sort((a, b) => {
      const t1 = this.parseFileDate(a.modifiedTime);
      const t2 = this.parseFileDate(b.modifiedTime);
      return t2 - t1;
    });
    const result: FeedItem[] = [];
    for (const item of listResponse.files) {
      const timestamp = this.parseFileDate(item.modifiedTime);
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
          serviceId: SERVICE_ID,
          iconUrl: '/s/svcs/google/drive.png',
          details: details,
          url: 'https://drive.google.com/open?id=' + item.id
        };
        result.push(match);
      }
    }
    return result;
  }

  private async listFiles(context: Context, args: any, googleUser: GoogleUser): Promise<DriveFilesListResponse> {
    return new Promise<DriveFilesListResponse>((resolve, reject) => {
      const drive = google.drive('v3');
      drive.files.list(args, (err: any, listResponse: DriveFilesListResponse) => {
        if (err) {
          reject(err);
        } else {
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
}

const googleDriveService = new GoogleDriveService();

export { googleDriveService };
