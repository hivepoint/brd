import fs = require('fs');
import * as express from "express";
import { Express, Request, Response } from 'express';
import net = require('net');
import http = require('http');
import https = require('https');
import Mustache = require('mustache');
import * as compression from "compression";
import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import * as path from "path";
import { config } from "./config";
import { RestServiceRegistrar, RestServiceHandler, RestServiceResult, RestServer } from "./interfaces/rest-server";
import { Context } from "./interfaces/context";
import { logger } from "./utils/logger";
import { utils } from "./utils/utils";
import { Initializable } from "./interfaces/initializable";
import { Startable } from "./interfaces/startable";
import { ExecutionContext } from "./execution-context";
import { emailManager } from "./email-manager";
import { database } from "./db";
import { waitingListManager } from "./waiting-list-manager";
import { userManager } from "./user-manager";
import { searchRestServer } from "./search-rest-server";
import { googleProvider } from "./providers/google/google-provider";
import { gmailSearcher } from "./providers/google/gmail-searcher";
import { googleDriveSearcher } from "./providers/google/drive-searcher";
import { servicesManager } from "./services-manager";
import { rootPageHandler } from "./page-handlers/root-handler";
import { userRestServer } from "./user-rest-server";
import { urlManager } from "./url-manager";

export class Server implements RestServiceRegistrar {

  private version = Date.now();
  private running = false;
  private app: express.Application;
  private redirectContent: string;
  private maxAge = 86400000;
  private clientServer: net.Server;
  private restServers: RestServer[] = [rootPageHandler, waitingListManager, userRestServer, searchRestServer, googleProvider, gmailSearcher, googleDriveSearcher];
  private initializables: Initializable[] = [rootPageHandler, emailManager, database];
  private startables: Startable[] = [googleProvider, servicesManager];
  private serverStatus = 'starting';

  async start(context: Context): Promise<void> {
    process.on('unhandledRejection', (reason: any) => {
      logger.error(context, 'server', "Unhandled Rejection!", JSON.stringify(reason), reason.stack);
    });

    process.on('uncaughtException', (err: any) => {
      logger.error(context, 'server', "Unhandled Exception!", err.toString(), err.stack);
    });

    this.initialize(context);
    for (const initializable of this.initializables) {
      await initializable.initialize(context);
    }

    await this.startServer(context);
    for (const startable of this.startables) {
      await startable.start(context);
    }
    this.serverStatus = 'OK';
  }

  private initialize(context: Context): void {
    const templatePath = path.join(__dirname, '../templates/redirect.html');
    this.redirectContent = fs.readFileSync(templatePath, 'utf8');
  }

  private async startServer(context: Context) {
    if (context.getConfig('client.maxAge')) {
      this.maxAge = context.getConfig('client.maxAge');
    }
    this.app = express();
    this.app.use(compression());
    this.app.use(bodyParser.json()); // for parsing application/json
    this.app.use(bodyParser.urlencoded({
      extended: true
    }));
    this.app.use(cookieParser());

    await this.registerHandlers(context);
    for (const restServer of this.restServers) {
      await restServer.initializeRestServices(context, this);
    }

    this.app.use(urlManager.getPublicBaseUrl(context), express.static(path.join(__dirname, '../public'), { maxAge: 1000 * 60 * 60 * 24 * 7 }));
    this.app.use(urlManager.getStaticBaseUrl(context), express.static(path.join(__dirname, "../static"), { maxAge: 1000 * 60 * 60 * 24 * 7 }));

    if (!context.getConfig('client.ssl')) {
      logger.log(context, "server", "startServer", "Using unencrypted client connections");
      this.clientServer = http.createServer(this.app);
    } else {
      logger.log(context, "server", "startServer", "Using encrypted client connections");
      const privateKey = fs.readFileSync(context.getConfig('ssl.key'), 'utf8');
      const certificate = fs.readFileSync(context.getConfig('ssl.cert'), 'utf8');
      const credentials: any = {
        key: privateKey,
        cert: certificate
      };
      const ca = this.getCertificateAuthority(context);
      if (ca) {
        credentials.ca = ca;
      }
      this.clientServer = https.createServer(credentials, this.app);
    }
    this.clientServer.listen(context.getConfig('client.port'), (err: any) => {
      if (err) {
        console.error("Failure listening", err);
        process.exit();
      } else {
        logger.log(context, "server", "startServer", "Listening for client connections on port " + context.getConfig('client.port'));
      }
    });
  }

  private registerHandlers(context: Context) {
    this.registerHandler(context, this.handlePingRequest.bind(this), 'get', '/ping', false, false);
  }

  private async handlePingRequest(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    response.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    response.setHeader('Content-Type', 'application/json');
    const result: any = {
      product: 'Braid',
      status: 'OK',
      version: context.getConfig('version'),
      deployed: new Date(this.version).toISOString(),
      server: context.getConfig('serverId')
    };
    return new RestServiceResult(result);
  }

  registerHandler(context: Context, handler: RestServiceHandler, action: string, suffix: string, dynamic: boolean, cacheable: boolean): void {
    switch (action) {
      case 'get':
        this.registerGet(context, handler, suffix, dynamic, cacheable);
        break;
      case 'put':
        this.registerPut(context, handler, suffix, dynamic, cacheable);
        break;
      case 'post':
        this.registerPost(context, handler, suffix, dynamic, cacheable);
        break;
      case 'delete':
        this.registerDelete(context, handler, suffix, dynamic, cacheable);
        break;
      default:
        throw new Error("Unsupported HTTP action " + action);
    }
  }

  private getCertificateAuthority(context: Context): string[] {
    let ca: string[];
    if (context.getConfig('ssl.ca')) {
      ca = [];
      const chain = fs.readFileSync(context.getConfig('ssl.ca'), 'utf8');
      const chains = chain.split("\n");
      let cert: string[] = [];
      for (const line of chains) {
        if (line.length > 0) {
          cert.push(line);
          if (line.match(/-END CERTIFICATE-/)) {
            ca.push(cert.join('\n'));
            cert = [];
          }
        }
      }
    }
    return ca;
  }

  private registerGet(context: Context, handler: RestServiceHandler, suffix: string, dynamic: boolean, cacheable: boolean, contentType?: string): void {
    this.app.get((dynamic ? urlManager.getDynamicBaseUrl(context) : '') + suffix, (request, response) => {
      void this.handleHttpRequest(context, request, response, handler, cacheable, contentType).then(() => {
        // noop
      });
    });
  }

  private registerPut(context: Context, handler: RestServiceHandler, suffix: string, dynamic: boolean, cacheable: boolean): void {
    this.app.put((dynamic ? urlManager.getDynamicBaseUrl(context) : '') + suffix, (request, response) => {
      void this.handleHttpRequest(context, request, response, handler, cacheable).then(() => {
        // noop
      });
    });
  }

  private registerPost(context: Context, handler: RestServiceHandler, suffix: string, dynamic: boolean, cacheable: boolean): void {
    this.app.post((dynamic ? urlManager.getDynamicBaseUrl(context) : '') + suffix, (request, response) => {
      void this.handleHttpRequest(context, request, response, handler, cacheable).then(() => {
        // noop
      });
    });
  }

  private registerDelete(context: Context, handler: RestServiceHandler, suffix: string, dynamic: boolean, cacheable: boolean): void {
    this.app.delete((dynamic ? urlManager.getDynamicBaseUrl(context) : '') + suffix, (request, response) => {
      void this.handleHttpRequest(context, request, response, handler, cacheable).then(() => {
        // noop
      });
    });
  }

  private async handleHttpRequest(parentContext: Context, request: Request, response: Response, handler: RestServiceHandler, cacheable: boolean, contentType?: string): Promise<void> {
    const context = new ExecutionContext('http', parentContext.getConfigData());
    try {
      if (!cacheable) {
        response.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      }
      const doNotHandle = await this.initializeHttpContext(context, request, response);
      if (!doNotHandle) {
        const result = await handler(context, request, response);
        if (result.redirectUrl) {
          this.redirectToUrl(context, request, response, result.redirectUrl);
        } else if (result.json) {
          response.json(result.json);
        } else {
          if (contentType) {
            response.contentType(contentType);
          }
          if (result.statusCode) {
            response.status(result.statusCode);
          } else {
            response.status(200);
          }
          if (result.message) {
            response.send(result.message);
          } else {
            response.end();
          }
        }
      }
      await context.finish();
    } catch (err) {
      logger.error(context, "server", "registerHttpHandler", "Exception", utils.logErrorObject(err));
      this.sendInternalError(context, request, response, err.toString());
      if (await context.finish(err)) {
        // throw err;
      }
    }
  }

  private async initializeHttpContext(context: Context, request: Request, response: Response) {
    context.serverId = context.getConfig('serverId');
    await userManager.initializeHttpContext(context, request, response);
  }

  private sendInternalError(context: Context, request: Request, response: Response, err: any) {
    response.setHeader('Content-Type', 'text/plain');
    response.status(500).send('Internal server error: ' + JSON.stringify(err));
  }

  private redirectToUrl(context: Context, request: Request, response: Response, toUrl: string) {
    const ogData = '';
    const view = {
      static_base: urlManager.getStaticBaseUrl(context),
      ogdata: ogData,
      url: toUrl,
      pageTitle: "Braid"
    };
    const output = Mustache.render(this.redirectContent, view);
    response.send(output);
  }
}

const server = new Server();
export { server };
