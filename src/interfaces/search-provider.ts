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

export interface SearchServiceDescriptor {
  id: string;  // e.g., com.hivepoint.search.google
  name: string;  // e.g. Gmail
  logoSquareUrl: string; // e.g., gmail icon
  searchUrl: string;  // the API to get to the REST service handling gmail search
}

export interface SearchProviderDescriptor {
  id: string;  // e.g., 'com.hivepoint.search.google'
  name: string; // e.g., 'Google'
  logoSquareUrl: string; // e.g., google icon
  authUrl: string;  // the URL to redirect to to initiate OAUTH
  services: SearchServiceDescriptor[];  // one for each service supported on Google
}
