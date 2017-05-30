
import { Context } from "./interfaces/context";
import { Initializable } from "./interfaces/initializable";
import url = require('url');

export class UrlManager {

  getStaticBaseUrl(context: Context, absolute = false): string {
    if (absolute) {
      return context.getConfig('baseClientUri') + '/s';
    } else {
      return '/s';
    }
  }
  getDynamicBaseUrl(context: Context, absolute = false): string {
    if (absolute) {
      return context.getConfig('baseClientUri') + '/d';
    } else {
      return '/d';
    }
  }

  getStaticUrl(context: Context, relativeUrl: string, absolute = false): string {
    if (!relativeUrl.startsWith('/')) {
      relativeUrl = '/' + relativeUrl;
    }
    if (absolute) {
      return context.getConfig('baseClientUri') + '/s' + relativeUrl;
    } else {
      return '/s' + relativeUrl;
    }
  }

  getDynamicUrl(context: Context, relativeUrl: string, absolute = false): string {
    if (!relativeUrl.startsWith('/')) {
      relativeUrl = '/' + relativeUrl;
    }
    if (absolute) {
      return context.getConfig('baseClientUri') + '/d' + relativeUrl;
    } else {
      return '/d' + relativeUrl;
    }
  }

  getVersionedUrl(context: Context, relativeUrl: string, absolute = false): string {
    if (!relativeUrl.startsWith('/')) {
      relativeUrl = '/' + relativeUrl;
    }
    if (absolute) {
      return context.getConfig('baseClientUri') + '/v' + context.getConfig('version') + relativeUrl;
    } else {
      return '/d' + relativeUrl;
    }
  }

}

const urlManager = new UrlManager();

export { urlManager };