import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { googleUsers, GoogleUser } from "../../db";
import { SearchMatch, SearchResult } from "../../interfaces/search-match";
import { utils } from "../../utils/utils";
import { SearchServiceDescriptor } from "../../interfaces/search-provider";
import { googleProvider } from "./google-provider";
const googleBatch = require('google-batch');
const google = googleBatch.require('googleapis');
const dateParser = require('parse-date/silent');
const addrparser = require('address-rfc2822');

const PROVIDER_ID = 'com.hivepoint.search.google';
const GMAIL_SERVICE_ID = 'gmail';
const DRIVE_SERVICE_ID = 'drive';

const CLIENT_ID = '465784242367-35slo3s2c649sos2r92t9kkhkqidm8vi.apps.googleusercontent.com';
const CLIENT_SECRET = 'HcxU0DLd_Uq0fegkYq92lrme';

export abstract class GoogleSearcher implements RestServer {
  protected PROVIDER_ID = 'com.hivepoint.search.google';

  abstract getDescriptor(context: Context): SearchServiceDescriptor;
  abstract getOauthScopes(): string[];
  // See https://developers.google.com/identity/protocols/googlescopes

  abstract initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void>;

  protected createOauthClient(context: Context, googleUser?: GoogleUser): any {
    return googleProvider.createOauthClient(context, googleUser);
  }
}
