import { Startable } from "./interfaces/startable";
import { ServiceProviderDescriptor, ProviderUserProfile } from "./interfaces/service-provider";
import { Context } from "./interfaces/context";
import { serviceProviders, SearchProvider } from "./db";
const Client = require('node-rest-client').Client;

export class ServicesManager implements Startable {
  private providers: SearchProvider[] = [];
  private providerDescriptors: ServiceProviderDescriptor[] = [];

  async start(context: Context): Promise<void> {
    this.providers = await serviceProviders.listAllActive(context);
    for (const provider of this.providers) {
      await this.loadProvider(context, provider);
    }
  }

  getProviderDescriptors(): ServiceProviderDescriptor[] {
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
    return new Promise<void>((resolve, reject) => {
      const client = new Client();
      const args = {
        parameters: {},
        requestConfig: {
          timeout: 10000
        },
        responseConfig: {
          timeout: 10000
        }
      };
      client.get(provider.serviceUrl, args, (data: ServiceProviderDescriptor, response: Response) => {
        this.providerDescriptors.push(data);
        resolve();
      }).on('error', (err: any) => {
        reject(err);
      });
    });
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
    return new Promise<ProviderUserProfile>((resolve, reject) => {
      const client = new Client();
      const args = {
        parameters: { braidUserId: braidUserId },
        requestConfig: {
          timeout: 10000
        },
        responseConfig: {
          timeout: 10000
        }
      };
      client.get(provider.serviceUrl + '/profile', args, (data: ProviderUserProfile, response: Response) => {
        resolve(data);
      }).on('error', (err: any) => {
        reject(err);
      });
    });
  }

}

const servicesManager = new ServicesManager();

export { servicesManager };
