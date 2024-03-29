import { RestServer, RestServiceRegistrar, RestServiceResult } from '../../interfaces/rest-server';
import { Request, Response } from 'express';
import { Context } from '../../interfaces/context';
import { googleUsers, GoogleUser } from "../../db";
import { utils } from "../../utils/utils";
import { ServiceDescriptor } from "../../interfaces/service-provider";
import { googleProvider } from "./google-provider";

const GMAIL_SERVICE_ID = 'gmail';
const DRIVE_SERVICE_ID = 'drive';

const CLIENT_ID = '465784242367-35slo3s2c649sos2r92t9kkhkqidm8vi.apps.googleusercontent.com';
const CLIENT_SECRET = 'HcxU0DLd_Uq0fegkYq92lrme';

export interface GoogleBatchResponse<T> {
  body: T;
}

export abstract class GoogleService implements RestServer {
  abstract getDescriptor(context: Context): ServiceDescriptor;
  abstract getOauthScopes(): string[];
  // See https://developers.google.com/identity/protocols/googlescopes

  abstract initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void>;

  protected createOauthClient(context: Context, googleUser?: GoogleUser): any {
    return googleProvider.createOauthClient(context, googleUser);
  }
}
