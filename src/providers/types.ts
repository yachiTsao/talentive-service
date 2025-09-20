export interface BaseJob {
  title: string;
  company: string;
  location: string;
  salary: string;
  date?: string;
  url: string;
  page: number;
  source: string; // 來源站點標識
}

export interface ProviderOptions {
  keyword: string;
  pages: number;
  delay: number; // 毫秒
  debug?: boolean; // debug 模式
}

export interface JobProvider {
  name: string;
  fetch(pageContext: import('playwright').Page, options: ProviderOptions): Promise<BaseJob[]>;
}