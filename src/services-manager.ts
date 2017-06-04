import { Startable } from "./interfaces/startable";
import { ServiceProviderDescriptor, ProviderUserProfile, ServiceProvider } from "./interfaces/service-provider";
import { Context } from "./interfaces/context";
import { RestClient } from "./utils/rest-client";
import { logger } from "./utils/logger";
import { utils } from "./utils/utils";
import { googleProvider } from "./providers/google/google-provider";
import { providerAccounts } from "./db";

export class ServicesManager implements Startable {
  private providersById: { [id: string]: ServiceProvider } = {};
  private providerDescriptors: ServiceProviderDescriptor[] = [];

  async start(context: Context): Promise<void> {
    const googleDescriptor = await googleProvider.getDescriptor(context);
    this.providersById[googleDescriptor.id] = googleProvider;
    this.providerDescriptors.push(googleDescriptor);

    // this.providers = await serviceProviders.listAllActive(context);
    // for (const provider of this.providers) {
    //   await this.loadProvider(context, provider);
    // }
  }

  getProviderDescriptors(context: Context, hideInternals: boolean): ServiceProviderDescriptor[] {
    if (!hideInternals) {
      return this.providerDescriptors;
    }
    let result: ServiceProviderDescriptor[];
    result = JSON.parse(JSON.stringify(this.providerDescriptors));
    for (const item of result) {
      delete item.authUrl;
      for (const service of item.services) {
        delete service.serviceUrl;
      }
    }
    return result;
  }

  getProviderDescriptorById(id: string): ServiceProviderDescriptor {
    for (const provider of this.providerDescriptors) {
      if (provider.id === id) {
        return provider;
      }
    }
    return null;
  }

  // private async loadProvider(context: Context, provider: SearchProvider): Promise<void> {
  //   try {
  //     logger.log(context, 'services', 'loadProvider', "Loading provider: " + provider.id);
  //     const descriptor = await RestClient.get<ServiceProviderDescriptor>(provider.serviceUrl, {});
  //     this.providerDescriptors.push(descriptor);
  //   } catch (err) {
  //     logger.error(context, 'services', 'loadProvider', 'Load failure', utils.logErrorObject(err));
  //   }
  // }

  // private getProviderById(id: string): SearchProvider {
  //   for (const provider of this.providers) {
  //     if (provider.id === id) {
  //       return provider;
  //     }
  //   }
  //   return null;
  // }

  async fetchUserProfile(context: Context, providerId: string, braidUserId: string): Promise<ProviderUserProfile> {
    const provider = this.providersById[providerId];
    if (!provider) {
      return null;
    }
    return await provider.getUserProfile(context, braidUserId);
  }

  async onUserDeleted(context: Context, userId: string): Promise<void> {
    await providerAccounts.deleteByUser(context, userId);
    for (const providerId of Object.keys(this.providersById)) {
      const provider = this.providersById[providerId];
      await provider.onUserDeleted(context, userId);
    }
  }
}

const servicesManager = new ServicesManager();

export { servicesManager };
