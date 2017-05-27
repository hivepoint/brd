import { Context } from './context';
import { Request, Response } from 'express';

export class RestServiceResult {
  message?: string;
  statusCode?: number;
  json?: any;
  redirectUrl?: string;

  constructor(json?: any, statusCode?: number, message?: string, redirectUrl?: string) {
    this.json = json;
    this.message = message;
    this.statusCode = statusCode;
    this.redirectUrl = redirectUrl;
  }
}

export type RestServiceHandler = (context: Context, request: Request, response: Response) => Promise<RestServiceResult>;

export interface RestServiceRegistrar {
  getPublicBase(): string;
  getDynamicBase(): string;
  registerHandler(context: Context, handler: RestServiceHandler, action: string, suffix: string, dynamic: boolean, cacheable: boolean): void;
}

export interface RestServer {
  initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void>;
}
