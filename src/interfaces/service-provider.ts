export const SERVICE_URL_SUFFIXES = {
  search: '/search',
  feed: '/feed'
};

export interface ProviderAccountProfile {
  accountId: string; // e.g., Google internal userId for kduffie@hivepoint.com
  name: string; // e.g., Kingston Duffie
  accountName?: string; // e.g. kduffie@hivepoint.com
  imageUrl?: string; // URL to my photo or avatar
  serviceIds: string[]; // a list of the SearchServiceDescriptors I've authorized
}

export interface ProviderUserProfile {
  providerId: string; // e.g. com.hivepoint.search.google
  braidUserId: string;  // a GUID for a Braid user
  accounts: ProviderAccountProfile[];  // one or more accounts authorized on Google
}

export interface ServiceDescriptor {
  id: string;  // e.g., com.hivepoint.search.google
  name: string;  // e.g. Gmail
  logoSquareUrl: string; // e.g., gmail icon
  serviceUrl: string;  // the base API for REST services
}

export interface ServiceProviderDescriptor {
  id: string;  // e.g., 'com.hivepoint.search.google'
  name: string; // e.g., 'Google'
  logoSquareUrl: string; // e.g., google icon
  authUrl: string;  // the URL to redirect to to initiate OAUTH
  services: ServiceDescriptor[];  // one for each service supported on Google
}

export interface FeedItem {
  providerId: string;
  serviceId: string;
  iconUrl: string;
  details: any;
  url?: string;
}

export interface SearchResult {
  matches: FeedItem[];
}

export interface FeedResult {
  items: FeedItem[];
}
