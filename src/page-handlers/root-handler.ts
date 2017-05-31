import path = require('path');
import fs = require('fs');
import url = require('url');
import Mustache = require('mustache');
import { Request, Response } from 'express';
import { Initializable } from '../interfaces/initializable';
import { RestServer, RestServiceRegistrar, RestServiceResult } from '../interfaces/rest-server';
import { Context } from '../interfaces/context';
import { urlManager } from "../url-manager";

export class RootPageHandler implements RestServer, Initializable {
  indexContent: string;
  registrar: RestServiceRegistrar;

  async initialize(context: Context): Promise<void> {
    const indexPath = path.join(__dirname, '../../public/index.html');
    this.indexContent = fs.readFileSync(indexPath, 'utf8');
  }

  async initializeRestServices(context: Context, registrar: RestServiceRegistrar): Promise<void> {
    this.registrar = registrar;
    registrar.registerHandler(context, this.handleRootPageRequest.bind(this), 'get', '/', false, false);
    registrar.registerHandler(context, this.handleRootPageRequest.bind(this), 'get', '/index.html', false, false);
  }

  private async handleRootPageRequest(context: Context, request: Request, response: Response): Promise<RestServiceResult> {
    const ogUrl = context.getConfig('baseClientUri');
    const metadata = {
      title: "Braid",
      description: "Braid is a personal cloud search engine. We aspire to give you the power to securely search all of the private content you access in the cloud.",
      url: ogUrl,
      image: url.resolve(ogUrl, '/s/images/logos/og.jpg'),
      imageWidth: 1200,
      imageHeight: 798
    };

    const view = {
      public_base: urlManager.getPublicBaseUrl(context),
      rest_base: urlManager.getDynamicBaseUrl(context),
      og_title: metadata.title,
      og_description: metadata.description,
      og_url: ogUrl,
      og_image: metadata.image,
      og_imagewidth: metadata.imageWidth,
      og_imageheight: metadata.imageHeight
    };
    const output = Mustache.render(this.indexContent, view);
    response.contentType('text/html');
    return new RestServiceResult(null, 200, output);
  }
}

const rootPageHandler = new RootPageHandler();
export { rootPageHandler };
