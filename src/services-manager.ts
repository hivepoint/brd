import { Startable } from "./interfaces/startable";
import { ServiceProviderDescriptor, ProviderUserProfile } from "./interfaces/service-provider";
import { Context } from "./interfaces/context";
import { serviceProviders, SearchProvider } from "./db";
import { RestClient } from "./utils/rest-client";
import { logger } from "./utils/logger";
import { utils } from "./utils/utils";

export class ServicesManager implements Startable {
  private providers: SearchProvider[] = [];
  private providerDescriptors: ServiceProviderDescriptor[] = [];

  async start(context: Context): Promise<void> {
    this.providers = await serviceProviders.listAllActive(context);
    for (const provider of this.providers) {
      await this.loadProvider(context, provider);
    }
  }

  getProviderDescriptors(context: Context, hideInternals: boolean): ServiceProviderDescriptor[] {
    let result: ServiceProviderDescriptor[];
    result = JSON.parse(JSON.stringify(this.providerDescriptors));
    for (const item of result) {
      delete item.authUrl;
      for (const service of item.services) {
        delete service.serviceUrl;
      }
    }
    return this.providerDescriptors;
  }

  getProviderDescriptorById(id: string): ServiceProviderDescriptor {
    for (const provider of this.providerDescriptors) {
      if (provider.id === id) {
        return provider;
      }
    }
    return null;
  }

  private async loadProvider(context: Context, provider: SearchProvider): Promise<void> {
    try {
      logger.log(context, 'services', 'loadProvider', "Loading provider: " + provider.id);
      const descriptor = await RestClient.get<ServiceProviderDescriptor>(provider.serviceUrl, {});
      this.providerDescriptors.push(descriptor);
    } catch (err) {
      logger.error(context, 'services', 'loadProvider', 'Load failure', utils.logErrorObject(err));
    }
  }

  private getProviderById(id: string): SearchProvider {
    for (const provider of this.providers) {
      if (provider.id === id) {
        return provider;
      }
    }
    return null;
  }

  async fetchUserProfile(context: Context, providerDescriptor: ServiceProviderDescriptor, braidUserId: string): Promise<ProviderUserProfile> {
    const provider = this.getProviderById(providerDescriptor.id);
    if (!provider) {
      throw new Error("No such provider");
    }
    return await RestClient.get<ProviderUserProfile>(provider.serviceUrl + '/profile', { braidUserId: braidUserId }, 10000, 10000);
  }

}

const servicesManager = new ServicesManager();

export { servicesManager };
