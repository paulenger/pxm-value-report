import * as XLSX from "xlsx";
import type { Metrics } from "./types";

const EXCLUDED_USERS = new Set([null, "", "System Generated", "Support Team"]);
const SHEET_NAMES = [
  "Shares",
  "Updates",
  "Imports",
  "Syndications",
  "File Downloads",
  "Product Downloads",
  "Products Created",
  "Files Uploaded",
  "File Shares",
];

function sheetRows(
  wb: XLSX.WorkBook,
  name: string
): { header: unknown[]; rows: unknown[][] } {
  if (!wb.SheetNames.includes(name)) return { header: [], rows: [] };
  const ws = wb.Sheets[name];
  const all = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  }) as unknown[][];
  if (!all.length) return { header: [], rows: [] };
  const header = all[0];
  const rows = all
    .slice(1)
    .filter((r) => r.some((v) => v !== null && v !== undefined && v !== ""));
  return { header, rows };
}

function toDate(v: unknown): Date | null {
  let d: Date | null = null;
  if (v instanceof Date) d = v;
  else if (typeof v === "string") {
    const parsed = new Date(v);
    if (!isNaN(parsed.getTime())) d = parsed;
  }
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function counter(arr: unknown[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const v of arr) {
    if (v === null || v === undefined) continue;
    const key = String(v);
    c[key] = (c[key] || 0) + 1;
  }
  return c;
}

function counterMostCommon(c: Record<string, number>): [string, number][] {
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

export function parseWorkbook(wb: XLSX.WorkBook): Metrics {
  const sheets: Record<
    string,
    { header: unknown[]; rows: unknown[][] }
  > = {};
  for (const n of SHEET_NAMES) sheets[n] = sheetRows(wb, n);

  const allDates: Date[] = [];
  for (const n of SHEET_NAMES) {
    const { rows } = sheets[n];
    for (const r of rows) {
      const d = toDate((r as unknown[])[0]);
      if (d) allDates.push(d);
    }
  }
  allDates.sort((a, b) => a.getTime() - b.getTime());
  const periodStart = allDates.length ? allDates[0] : null;
  const periodEnd = allDates.length ? allDates[allDates.length - 1] : null;

  const productsCreated = sheets["Products Created"].rows.length;
  const filesUploaded = sheets["Files Uploaded"].rows.length;

  const updatesHeader = sheets["Updates"].header;
  const updatesRows = sheets["Updates"].rows;
  const actionIdx = (updatesHeader as string[]).indexOf("Update Action");
  const updatesTotal = updatesRows.length;
  const updateActionBreakdown = counter(
    updatesRows.map((r) => (actionIdx >= 0 ? (r as unknown[])[actionIdx] : null))
  );

  const importsHeader = sheets["Imports"].header;
  const importsRows = sheets["Imports"].rows;
  const typeIdx = (importsHeader as string[]).indexOf("Import Type");
  const importsTotal = importsRows.length;
  const importTypeBreakdown = counter(
    importsRows.map((r) => (typeIdx >= 0 ? (r as unknown[])[typeIdx] : null))
  );

  const synHeader = sheets["Syndications"].header;
  const synRows = sheets["Syndications"].rows;
  const statusIdx = (synHeader as string[]).indexOf("Status");
  const syndicationsTotal = synRows.length;
  const syndicationStatusBreakdown = counter(
    synRows.map((r) => (statusIdx >= 0 ? (r as unknown[])[statusIdx] : null))
  );
  const successStatuses = new Set(["ACCEPTED", "PARTIAL ACCEPTED"]);
  let success = 0;
  for (const [k, v] of Object.entries(syndicationStatusBreakdown)) {
    if (successStatuses.has(k)) success += v;
  }
  const syndicationSuccessRate = syndicationsTotal
    ? success / syndicationsTotal
    : null;

  const sharesTotal = sheets["Shares"].rows.length;
  const fileSharesTotal = sheets["File Shares"].rows.length;
  const fileDownloadsTotal = sheets["File Downloads"].rows.length;
  const productDownloadsTotal = sheets["Product Downloads"].rows.length;

  const contrib: Record<string, number> = {};
  for (const sn of ["Updates", "Imports", "Syndications"]) {
    const { header, rows } = sheets[sn];
    const uidx = (header as string[]).indexOf("User");
    if (uidx < 0) continue;
    for (const r of rows) {
      const u = (r as unknown[])[uidx] as string | null;
      if (EXCLUDED_USERS.has(u)) continue;
      if (!u) continue;
      contrib[u] = (contrib[u] || 0) + 1;
    }
  }
  const topContributors = counterMostCommon(contrib);

  const weekly: Record<string, number> = {};
  for (const sn of [
    "Updates",
    "Imports",
    "Syndications",
    "Products Created",
    "Files Uploaded",
    "Shares",
  ]) {
    const { rows } = sheets[sn];
    for (const r of rows) {
      const d = toDate((r as unknown[])[0]);
      if (!d || !periodStart) continue;
      const daysIn = Math.floor(
        (d.getTime() - periodStart.getTime()) / 86400000
      );
      const weekIdx = Math.floor(daysIn / 7);
      const weekStart = new Date(
        periodStart.getTime() + weekIdx * 7 * 86400000
      );
      const key = dayKey(weekStart);
      weekly[key] = (weekly[key] || 0) + 1;
    }
  }
  const weeklyActivity = Object.entries(weekly).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  const clientSideActivityTotal =
    fileDownloadsTotal + productDownloadsTotal + sharesTotal;
  const totalPlatformActions =
    updatesTotal +
    importsTotal +
    syndicationsTotal +
    productsCreated +
    filesUploaded +
    sharesTotal;

  return {
    period_start: periodStart,
    period_end: periodEnd,
    products_created: productsCreated,
    files_uploaded: filesUploaded,
    updates_total: updatesTotal,
    update_action_breakdown: updateActionBreakdown,
    imports_total: importsTotal,
    import_type_breakdown: importTypeBreakdown,
    syndications_total: syndicationsTotal,
    syndication_status_breakdown: syndicationStatusBreakdown,
    syndication_success_rate: syndicationSuccessRate,
    shares_total: sharesTotal,
    file_shares_total: fileSharesTotal,
    file_downloads_total: fileDownloadsTotal,
    product_downloads_total: productDownloadsTotal,
    top_contributors: topContributors,
    weekly_activity: weeklyActivity,
    client_side_activity_total: clientSideActivityTotal,
    total_platform_actions: totalPlatformActions,
  };
}

export function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

export function fmtDate(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "-";
}

export function counterMostCommonExport(
  c: Record<string, number>
): [string, number][] {
  return counterMostCommon(c);
}
