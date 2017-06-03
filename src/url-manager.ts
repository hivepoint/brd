
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
  getPublicBaseUrl(context: Context, absolute = false): string {
    const baseUrl = '/v' + context.getConfig('version');
    if (absolute) {
      return context.getConfig('baseClientUri') + baseUrl;
    }
    return baseUrl;
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

  getDynamicUrl(context: Context, relativeUrl: string, absolute = false, internal = false): string {
    if (!relativeUrl.startsWith('/')) {
      relativeUrl = '/' + relativeUrl;
    }
    if (absolute) {
      if (internal) {
        return context.getConfig('internalRestUri') + '/d' + relativeUrl;
      } else {
        return context.getConfig('baseClientUri') + '/d' + relativeUrl;
      }
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
