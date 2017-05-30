export interface SearchMatch {
  providerId: string;
  serviceId: string;
  iconUrl: string;
  details: any;
  url?: string;
}

export interface SearchResult {
  matches: SearchMatch[];
}
