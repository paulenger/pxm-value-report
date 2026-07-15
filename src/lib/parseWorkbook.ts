import * as XLSX from "xlsx";
import type {
  Metrics,
  UpdatesData,
  ImportsData,
  SyndicationsData,
  FilesUploadedData,
  ProductsCreatedData,
  SharesData,
  FileDownloadsData,
  ProductDownloadsData,
  FileSharesData,
} from "./types";

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
): { header: string[]; rows: unknown[][] } {
  if (!wb.SheetNames.includes(name)) return { header: [], rows: [] };
  const ws = wb.Sheets[name];
  const all = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  }) as unknown[][];
  if (!all.length) return { header: [], rows: [] };
  const header = (all[0] as unknown[]).map((h) => String(h ?? ""));
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
    if (!key) continue;
    c[key] = (c[key] || 0) + 1;
  }
  return c;
}

function sorted(c: Record<string, number>): [string, number][] {
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

function counterMostCommon(c: Record<string, number>): [string, number][] {
  return sorted(c);
}

function computeWeekly(
  rows: unknown[][],
  periodStart: Date | null
): [string, number][] {
  if (!periodStart) return [];
  const weekly: Record<string, number> = {};
  for (const r of rows) {
    const d = toDate((r as unknown[])[0]);
    if (!d) continue;
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
  return Object.entries(weekly).sort((a, b) => a[0].localeCompare(b[0]));
}

function getContributors(
  rows: unknown[][],
  header: string[]
): [string, number][] {
  // Look for User, Sender, or User Email column
  const userColNames = ["User", "Sender", "User Email"];
  let uidx = -1;
  for (const colName of userColNames) {
    const idx = header.indexOf(colName);
    if (idx >= 0) {
      uidx = idx;
      break;
    }
  }
  if (uidx < 0) return [];
  const contrib: Record<string, number> = {};
  for (const r of rows) {
    const u = (r as unknown[])[uidx] as string | null;
    if (EXCLUDED_USERS.has(u)) continue;
    if (!u) continue;
    contrib[u] = (contrib[u] || 0) + 1;
  }
  return sorted(contrib);
}

export function parseWorkbook(wb: XLSX.WorkBook): Metrics {
  const sheets: Record<string, { header: string[]; rows: unknown[][] }> = {};
  for (const n of SHEET_NAMES) sheets[n] = sheetRows(wb, n);

  // Determine period range across all sheets
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

  // ---- Updates ----
  let updatesData: UpdatesData | null = null;
  {
    const { header, rows } = sheets["Updates"];
    if (rows.length > 0) {
      const actionIdx = header.indexOf("Update Action");
      const changeSourceIdx = header.indexOf("Change Source");
      const processedCountIdx = header.indexOf("Processed Count");

      const byAction = sorted(
        counter(rows.map((r) => (actionIdx >= 0 ? (r as unknown[])[actionIdx] : null)))
      );
      const byChangeSource = changeSourceIdx >= 0
        ? sorted(counter(rows.map((r) => (r as unknown[])[changeSourceIdx])))
        : [];

      // Remove empty change source entries
      const byChangeSourceFiltered = byChangeSource.filter(([k]) => k !== "null" && k !== "");

      // Processed Count sum (not typically on Updates but handle gracefully)
      void processedCountIdx;

      updatesData = {
        total: rows.length,
        byAction,
        byChangeSource: byChangeSourceFiltered,
        contributors: getContributors(rows, header),
        weekly: computeWeekly(rows, periodStart),
      };
    }
  }

  // ---- Imports ----
  let importsData: ImportsData | null = null;
  {
    const { header, rows } = sheets["Imports"];
    if (rows.length > 0) {
      const typeIdx = header.indexOf("Import Type");
      const processedIdx = header.indexOf("Processed Count");
      const byType = sorted(
        counter(rows.map((r) => (typeIdx >= 0 ? (r as unknown[])[typeIdx] : null)))
      );
      let processedTotal = 0;
      if (processedIdx >= 0) {
        for (const r of rows) {
          const v = (r as unknown[])[processedIdx];
          if (typeof v === "number") processedTotal += v;
          else if (typeof v === "string") {
            const n = parseFloat(v);
            if (!isNaN(n)) processedTotal += n;
          }
        }
      }
      importsData = {
        total: rows.length,
        byType,
        processedTotal,
        contributors: getContributors(rows, header),
        weekly: computeWeekly(rows, periodStart),
      };
    }
  }

  // ---- Syndications ----
  let syndicationsData: SyndicationsData | null = null;
  {
    const { header, rows } = sheets["Syndications"];
    if (rows.length > 0) {
      const statusIdx = header.indexOf("Status");
      const synTypeIdx = header.indexOf("Syndication Type");
      const byStatus = statusIdx >= 0
        ? counter(rows.map((r) => (r as unknown[])[statusIdx]))
        : {};
      const bySyndicationType = synTypeIdx >= 0
        ? sorted(counter(rows.map((r) => (r as unknown[])[synTypeIdx])))
        : [];
      const successStatuses = new Set(["ACCEPTED", "PARTIAL ACCEPTED"]);
      let success = 0;
      for (const [k, v] of Object.entries(byStatus)) {
        if (successStatuses.has(k)) success += v;
      }
      const successRate = rows.length ? success / rows.length : 0;
      syndicationsData = {
        total: rows.length,
        byStatus,
        bySyndicationType,
        successRate,
        contributors: getContributors(rows, header),
        weekly: computeWeekly(rows, periodStart),
      };
    }
  }

  // ---- Files Uploaded ----
  let filesUploadedData: FilesUploadedData | null = null;
  {
    const { header, rows } = sheets["Files Uploaded"];
    if (rows.length > 0) {
      const domainIdx = header.indexOf("Domain");
      const byDomain = domainIdx >= 0
        ? sorted(counter(rows.map((r) => (r as unknown[])[domainIdx]))).slice(0, 10)
        : [];
      filesUploadedData = {
        total: rows.length,
        byDomain,
        weekly: computeWeekly(rows, periodStart),
      };
    }
  }

  // ---- Products Created ----
  let productsCreatedData: ProductsCreatedData | null = null;
  {
    const { header, rows } = sheets["Products Created"];
    if (rows.length > 0) {
      const domainIdx = header.indexOf("Domain");
      const byDomain = domainIdx >= 0
        ? sorted(counter(rows.map((r) => (r as unknown[])[domainIdx])))
        : [];
      productsCreatedData = {
        total: rows.length,
        byDomain,
        weekly: computeWeekly(rows, periodStart),
      };
    }
  }

  // ---- Shares ----
  let sharesData: SharesData | null = null;
  {
    const { header, rows } = sheets["Shares"];
    if (rows.length > 0) {
      const actionIdx = header.indexOf("Action");
      const byAction = actionIdx >= 0
        ? sorted(counter(rows.map((r) => (r as unknown[])[actionIdx])))
        : [];
      sharesData = {
        total: rows.length,
        byAction,
        contributors: getContributors(rows, header),
        weekly: computeWeekly(rows, periodStart),
      };
    }
  }

  // ---- File Downloads ----
  let fileDownloadsData: FileDownloadsData | null = null;
  {
    const { header, rows } = sheets["File Downloads"];
    if (rows.length > 0) {
      const fileNameIdx = header.indexOf("File Name");
      const typeIdx = header.indexOf("Type");
      const byFileName = fileNameIdx >= 0
        ? sorted(counter(rows.map((r) => (r as unknown[])[fileNameIdx]))).slice(0, 8)
        : [];
      const byType = typeIdx >= 0
        ? sorted(counter(rows.map((r) => (r as unknown[])[typeIdx])))
        : [];
      fileDownloadsData = {
        total: rows.length,
        byFileName,
        byType,
        contributors: getContributors(rows, header),
        weekly: computeWeekly(rows, periodStart),
      };
    }
  }

  // ---- Product Downloads ----
  let productDownloadsData: ProductDownloadsData | null = null;
  {
    const { header, rows } = sheets["Product Downloads"];
    if (rows.length > 0) {
      const productNameIdx = header.indexOf("Product Name");
      const byProductName = productNameIdx >= 0
        ? sorted(counter(rows.map((r) => (r as unknown[])[productNameIdx]))).slice(0, 8)
        : [];
      productDownloadsData = {
        total: rows.length,
        byProductName,
        contributors: getContributors(rows, header),
        weekly: computeWeekly(rows, periodStart),
      };
    }
  }

  // ---- File Shares ----
  let fileSharesData: FileSharesData | null = null;
  {
    const { header, rows } = sheets["File Shares"];
    if (rows.length > 0) {
      const shareTypeIdx = header.indexOf("Share Type");
      const senderIdx = header.indexOf("Sender");
      const byShareType = shareTypeIdx >= 0
        ? sorted(counter(rows.map((r) => (r as unknown[])[shareTypeIdx])))
        : [];
      const bySender = senderIdx >= 0
        ? sorted(counter(rows.map((r) => {
            const v = (r as unknown[])[senderIdx] as string | null;
            if (EXCLUDED_USERS.has(v)) return null;
            return v;
          })))
        : [];
      fileSharesData = {
        total: rows.length,
        byShareType,
        bySender,
        weekly: computeWeekly(rows, periodStart),
      };
    }
  }

  // ---- Global weekly activity (across all content sheets) ----
  const weeklyAll: Record<string, number> = {};
  for (const sn of [
    "Updates",
    "Imports",
    "Syndications",
    "Products Created",
    "Files Uploaded",
    "Shares",
    "File Downloads",
    "Product Downloads",
    "File Shares",
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
      weeklyAll[key] = (weeklyAll[key] || 0) + 1;
    }
  }
  const weeklyActivity = Object.entries(weeklyAll).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  // ---- Top contributors (combined) ----
  const contrib: Record<string, number> = {};
  for (const sn of ["Updates", "Imports", "Syndications"]) {
    const { header, rows } = sheets[sn];
    const uidx = header.indexOf("User");
    if (uidx < 0) continue;
    for (const r of rows) {
      const u = (r as unknown[])[uidx] as string | null;
      if (EXCLUDED_USERS.has(u)) continue;
      if (!u) continue;
      contrib[u] = (contrib[u] || 0) + 1;
    }
  }
  const topContributors = counterMostCommon(contrib);

  // ---- Totals ----
  const updatesTotal = updatesData?.total ?? 0;
  const importsTotal = importsData?.total ?? 0;
  const syndicationsTotal = syndicationsData?.total ?? 0;
  const filesUploadedTotal = filesUploadedData?.total ?? 0;
  const productsCreatedTotal = productsCreatedData?.total ?? 0;
  const sharesTotal = sharesData?.total ?? 0;
  const fileDownloadsTotal = fileDownloadsData?.total ?? 0;
  const productDownloadsTotal = productDownloadsData?.total ?? 0;

  const clientSideActivityTotal =
    fileDownloadsTotal + productDownloadsTotal + sharesTotal;
  const totalPlatformActions =
    updatesTotal +
    importsTotal +
    syndicationsTotal +
    productsCreatedTotal +
    filesUploadedTotal +
    sharesTotal;

  return {
    period_start: periodStart,
    period_end: periodEnd,
    total_platform_actions: totalPlatformActions,
    client_side_activity_total: clientSideActivityTotal,
    weekly_activity: weeklyActivity,
    top_contributors: topContributors,
    updates: updatesData,
    imports: importsData,
    syndications: syndicationsData,
    files_uploaded: filesUploadedData,
    products_created: productsCreatedData,
    shares: sharesData,
    file_downloads: fileDownloadsData,
    product_downloads: productDownloadsData,
    file_shares: fileSharesData,
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

export function fmtDateShort(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "-";
}

export function counterMostCommonExport(
  c: Record<string, number>
): [string, number][] {
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
