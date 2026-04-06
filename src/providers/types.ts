export interface BaseJob {
  id: string; // SHA-256(url) 前 8 碼十六進位
  title: string;
  company: string;
  location: string;
  salary: string;
  date?: string;
  url: string;
  page: number;
  source: string; // 來源站點標識
}

// Provider 回傳的原始資料，id 由 crawler 層統一注入
export type JobData = Omit<BaseJob, 'id'>;

export interface ProviderOptions {
  keyword: string;
  pages: number;
  delay: number; // 毫秒
  debug?: boolean; // debug 模式
}

export interface JobProvider {
  name: string;
  fetch(pageContext: import('playwright').Page, options: ProviderOptions): Promise<JobData[]>;
}