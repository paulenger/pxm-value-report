export interface UpdatesData {
  total: number;
  byAction: [string, number][];
  byChangeSource: [string, number][];
  contributors: [string, number][];
  weekly: [string, number][];
}
export interface ImportsData {
  total: number;
  byType: [string, number][];
  processedTotal: number;
  contributors: [string, number][];
  weekly: [string, number][];
}
export interface SyndicationsData {
  total: number;
  byStatus: Record<string, number>;
  bySyndicationType: [string, number][];
  successRate: number;
  contributors: [string, number][];
  weekly: [string, number][];
}
export interface FilesUploadedData {
  total: number;
  byDomain: [string, number][];
  weekly: [string, number][];
}
export interface ProductsCreatedData {
  total: number;
  byDomain: [string, number][];
  weekly: [string, number][];
}
export interface SharesData {
  total: number;
  byAction: [string, number][];
  contributors: [string, number][];
  weekly: [string, number][];
}
export interface FileDownloadsData {
  total: number;
  byFileName: [string, number][];
  byType: [string, number][];
  contributors: [string, number][];
  weekly: [string, number][];
}
export interface ProductDownloadsData {
  total: number;
  byProductName: [string, number][];
  contributors: [string, number][];
  weekly: [string, number][];
}
export interface FileSharesData {
  total: number;
  byShareType: [string, number][];
  bySender: [string, number][];
  weekly: [string, number][];
}
export interface UserRow {
  user: string;
  totalActions: number;
  byAction: [string, number][];
  orgUnits: string[] | null;
  userRole: string | null;
}
export interface UsersData {
  total: number;
  rows: UserRow[];
}
export interface Metrics {
  period_start: Date | null;
  period_end: Date | null;
  total_platform_actions: number;
  client_side_activity_total: number;
  weekly_activity: [string, number][];
  top_contributors: [string, number][];
  updates: UpdatesData | null;
  imports: ImportsData | null;
  syndications: SyndicationsData | null;
  files_uploaded: FilesUploadedData | null;
  products_created: ProductsCreatedData | null;
  shares: SharesData | null;
  file_downloads: FileDownloadsData | null;
  product_downloads: ProductDownloadsData | null;
  file_shares: FileSharesData | null;
  users: UsersData | null;
}

export interface ReportConfig {
  brandName: string;
  csmName: string;
  teamNames: Set<string>;
  customLogoDataUrl: string | null;
}
