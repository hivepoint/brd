
export interface NewsUserItem {
  title: string;
  name: string;
  imageUrl?: string;
}
export interface NewsItem {
  timestamp: number;
  iconUrl?: string;
  imageUrl?: string;
  title: string;
  subtitle?: string;
  bodyMarkup?: string;
  sourceLink?: string;
  users: NewsUserItem[];
}

export interface NewsFeed {
  items: NewsItem[];
}
