export interface PageRecord {
  page: number;
  url: string;
  filename: string;
  done: boolean;
  times: number;
}

export interface DataJson {
  title: string;
  size: number;
  pages: PageRecord[];
}
