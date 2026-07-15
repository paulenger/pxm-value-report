export interface Metrics {
  period_start: Date | null;
  period_end: Date | null;
  products_created: number;
  files_uploaded: number;
  updates_total: number;
  update_action_breakdown: Record<string, number>;
  imports_total: number;
  import_type_breakdown: Record<string, number>;
  syndications_total: number;
  syndication_status_breakdown: Record<string, number>;
  syndication_success_rate: number | null;
  shares_total: number;
  file_shares_total: number;
  file_downloads_total: number;
  product_downloads_total: number;
  top_contributors: [string, number][];
  weekly_activity: [string, number][];
  client_side_activity_total: number;
  total_platform_actions: number;
}

export interface ReportConfig {
  brandName: string;
  csmName: string;
  teamNames: Set<string>;
  customLogoDataUrl: string | null;
}
