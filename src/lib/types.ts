export type Page = {
  page: number;
  url: string;
  done: boolean;
  times: number;
};

export type Data = {
  title: string;
  url: string;
  size: number;
  pages: Page[];
};
