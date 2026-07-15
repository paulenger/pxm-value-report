"use client";

import React from "react";
import type { Metrics, ReportConfig } from "@/lib/types";
import { fmtNum, fmtDate, counterMostCommonExport } from "@/lib/parseWorkbook";

const STATUS_COLORS: Record<string, string> = {
  ACCEPTED: "var(--p-blue)",
  "PARTIAL ACCEPTED": "var(--p-blue-light)",
  DRAFT: "#C9D2D6",
  "IN PROGRESS": "var(--amber)",
  REJECTED: "var(--red)",
  "API FAILURE": "var(--red-dark)",
};
const STATUS_ORDER = [
  "ACCEPTED",
  "PARTIAL ACCEPTED",
  "DRAFT",
  "IN PROGRESS",
  "REJECTED",
  "API FAILURE",
];
const IMPORT_LABELS: Record<string, string> = {
  image_stack: "Image stack builds",
  file_folder_tagging: "File & folder tagging",
  data_import: "Data imports",
  bulk_attribute_update: "Bulk attribute updates",
};
const UPDATE_LABELS: Record<string, string> = {
  Import: "Import-driven updates",
  "Media Removed": "Media removed",
  "Publish To Channel": "Published to channel",
  "Attribute(s) Removed": "Attributes removed",
  "System Generated": "System generated",
  "Media Added": "Media added",
  "Attribute(s) Added": "Attributes added",
  "Collection Folder Updated": "Collection folders updated",
};

interface ReportProps {
  metrics: Metrics;
  config: ReportConfig;
}

export default function Report({ metrics: m, config }: ReportProps) {
  const { brandName, csmName, teamNames, customLogoDataUrl } = config;

  const nDays =
    m.period_start && m.period_end
      ? Math.round(
          (m.period_end.getTime() - m.period_start.getTime()) / 86400000
        ) + 1
      : 0;
  const synTotal = m.syndications_total;
  const hasSyndication = synTotal > 0;
  const synPct =
    m.syndication_success_rate !== null
      ? Math.round(m.syndication_success_rate * 100) + "%"
      : "-";

  const kpiListDefs = [
    {
      display: fmtNum(m.products_created),
      label: "Products Created",
      show: m.products_created > 0,
    },
    {
      display: fmtNum(m.files_uploaded),
      label: "Files Uploaded",
      show: m.files_uploaded > 0,
    },
    {
      display: fmtNum(m.updates_total),
      label: "Updates",
      show: m.updates_total > 0,
    },
    {
      display: fmtNum(m.imports_total),
      label: "Imports",
      show: m.imports_total > 0,
    },
    {
      display: fmtNum(synTotal),
      label: "Syndications",
      show: hasSyndication,
    },
    {
      display: synPct,
      label: "Syndication success rate",
      show: hasSyndication,
    },
  ].filter((k) => k.show);

  const clientListDefs = [
    {
      display: fmtNum(m.shares_total),
      label: "Shares",
      show: m.shares_total > 0,
    },
    {
      display: fmtNum(m.file_shares_total),
      label: "File Shares",
      show: m.file_shares_total > 0,
    },
    {
      display: fmtNum(m.file_downloads_total),
      label: "File Downloads",
      show: m.file_downloads_total > 0,
    },
    {
      display: fmtNum(m.product_downloads_total),
      label: "Product Downloads",
      show: m.product_downloads_total > 0,
    },
  ].filter((k) => k.show);

  // Auto-summary
  const categories = [
    {
      value: synTotal,
      sentence: `This period's activity centered on marketplace syndication: ${fmtNum(synTotal)} events processed${m.syndication_success_rate !== null ? ` with a ${Math.round(m.syndication_success_rate * 100)}% acceptance rate` : ""}.`,
    },
    {
      value: m.files_uploaded,
      sentence: `Most of this period's work was file and image processing: ${fmtNum(m.files_uploaded)} files handled across the account.`,
    },
    {
      value: m.products_created,
      sentence: `This period centered on product data management: ${fmtNum(m.products_created)} products created or updated.`,
    },
    {
      value: m.updates_total,
      sentence: `This period's activity was driven by platform updates: ${fmtNum(m.updates_total)} update events logged.`,
    },
    {
      value: m.imports_total,
      sentence: `This period's activity centered on data imports: ${fmtNum(m.imports_total)} import jobs processed.`,
    },
  ].sort((a, b) => b.value - a.value);
  const summaryText = categories[0].value > 0 ? categories[0].sentence : null;

  // Weekly bar chart
  const maxVal = Math.max(1, ...m.weekly_activity.map(([, v]) => v));
  const bars = m.weekly_activity.map(([key, val]) => {
    const d = new Date(key + "T00:00:00");
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const h = Math.max(4, Math.round((val / maxVal) * 52));
    return { label, val, h };
  });

  // Donut
  let donutGradient = "#E4E8EA";
  let acceptedPct = 0;
  if (hasSyndication) {
    let cum = 0;
    const stops: string[] = [];
    for (const status of STATUS_ORDER) {
      const v = m.syndication_status_breakdown[status] || 0;
      if (!v) continue;
      const start = (cum / synTotal) * 100;
      cum += v;
      const end = (cum / synTotal) * 100;
      stops.push(`${STATUS_COLORS[status]} ${start}% ${end}%`);
    }
    donutGradient = stops.length
      ? `conic-gradient(${stops.join(",")})`
      : "#E4E8EA";
    acceptedPct = Math.round(
      (((m.syndication_status_breakdown["ACCEPTED"] || 0) +
        (m.syndication_status_breakdown["PARTIAL ACCEPTED"] || 0)) /
        synTotal) *
        100
    );
  }

  const importEntries = counterMostCommonExport(m.import_type_breakdown);
  const updateEntries = counterMostCommonExport(m.update_action_breakdown);

  return (
    <div className="report-page" id="report-page">
      {/* Header */}
      <div className="header-band">
        <div className="band-top-row">
          <div className="brand-lockup">
            {customLogoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="custom-logo" src={customLogoDataUrl} alt="Logo" />
            ) : (
              <>
                <div className="brand-badge">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="7" height="7" rx="1.4" fill="#fff" />
                    <rect x="14" y="3" width="7" height="7" rx="1.4" fill="#fff" opacity="0.55" />
                    <rect x="3" y="14" width="7" height="7" rx="1.4" fill="#fff" opacity="0.55" />
                    <rect x="14" y="14" width="7" height="7" rx="1.4" fill="#fff" />
                  </svg>
                </div>
                <div className="brand-word">
                  Pattern<span> | PXM</span>
                </div>
              </>
            )}
          </div>
          <div className="period-badge">
            Reporting period
            <br />
            <strong>
              {fmtDate(m.period_start)} &ndash; {fmtDate(m.period_end)}
            </strong>{" "}
            ({nDays} days)
          </div>
        </div>
        <div className="eyebrow">PXM Activity &amp; Value Report</div>
        <h1 className="report-h1">{brandName}</h1>
      </div>

      {/* Intro */}
      <p className="intro">
        A summary of the work completed inside your PXM account this period:
        product data management, file processing, and marketplace syndication,
        regardless of how much time your team spent logged in.
      </p>

      {/* Summary line */}
      {summaryText && <div className="summary-line">{summaryText}</div>}

      {/* KPI Hero */}
      <div className="kpi-hero">
        <div className="num">{fmtNum(m.total_platform_actions)}</div>
        <div className="label">Total platform actions</div>
      </div>

      {/* KPI List */}
      {kpiListDefs.length > 0 && (
        <div className="kpi-list">
          {kpiListDefs.map((k) => (
            <div className="kpi-item" key={k.label}>
              <div className="item-label">{k.label}</div>
              <div className="item-num">{k.display}</div>
            </div>
          ))}
        </div>
      )}

      {/* Client-side activity */}
      {clientListDefs.length > 0 && (
        <>
          <div className="mini-caption">Client-side activity</div>
          <div className="kpi-list">
            {clientListDefs.map((k) => (
              <div className="kpi-item" key={k.label}>
                <div className="item-label">{k.label}</div>
                <div className="item-num">{k.display}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Weekly bar chart */}
      {bars.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div className="section-title">Weekly Platform Activity</div>
          <div className="barchart">
            {bars.map((b, i) => (
              <div className="bar-col" key={i}>
                <div className="bar-val">{fmtNum(b.val)}</div>
                <div className="bar" style={{ height: b.h }} />
              </div>
            ))}
          </div>
          <div className="bar-labels">
            {bars.map((b, i) => (
              <div key={i}>{b.label}</div>
            ))}
          </div>
          <div className="chart-caption">
            Updates, imports, syndications, product creation, and file uploads,
            by week.
          </div>
        </div>
      )}

      {/* Detail grid */}
      <div className="detail-grid">
        {/* Syndication donut */}
        {hasSyndication && (
          <div className="detail-block">
            <div className="section-title">Syndication Outcomes</div>
            <div className="donut-wrap">
              <div style={{ position: "relative", width: 106, height: 106 }}>
                <div
                  className="donut"
                  style={{ background: donutGradient }}
                />
                <div className="donut-center">
                  <div className="pct">{acceptedPct}%</div>
                  <div className="pctlabel">accepted</div>
                </div>
              </div>
              <div className="donut-legend">
                <div>
                  <b>{fmtNum(synTotal)}</b> total syndication events
                </div>
                <div>
                  <b>
                    {fmtNum(m.syndication_status_breakdown["ACCEPTED"] || 0)}
                  </b>{" "}
                  fully accepted
                </div>
                <div>
                  <b>
                    {fmtNum(
                      m.syndication_status_breakdown["PARTIAL ACCEPTED"] || 0
                    )}
                  </b>{" "}
                  partially accepted
                </div>
                <div>
                  <b>
                    {fmtNum(
                      (m.syndication_status_breakdown["REJECTED"] || 0) +
                        (m.syndication_status_breakdown["API FAILURE"] || 0)
                    )}
                  </b>{" "}
                  rejected / failed
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import breakdown */}
        {importEntries.length > 0 && (
          <div className="detail-block">
            <div className="section-title">Data &amp; File Work Completed</div>
            <table className="detail-table">
              <tbody>
                {importEntries.map(([k, v]) => (
                  <tr key={k}>
                    <td>{IMPORT_LABELS[k] || k}</td>
                    <td className="num">{fmtNum(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Update breakdown */}
        {updateEntries.length > 0 && (
          <div className="detail-block">
            <div className="section-title">Update Activity Breakdown</div>
            <table className="detail-table">
              <tbody>
                {updateEntries.map(([k, v]) => (
                  <tr key={k}>
                    <td>{UPDATE_LABELS[k] || k}</td>
                    <td className="num">{fmtNum(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Contributors */}
        {m.top_contributors.length > 0 && (
          <div className="detail-block">
            <div className="section-title">Work Completed By</div>
            <table className="detail-table">
              <tbody>
                {m.top_contributors.slice(0, 6).map(([name, count]) => {
                  const isTeam = teamNames.has(String(name).toLowerCase());
                  return (
                    <tr key={name}>
                      <td className="name">
                        {name}
                        {isTeam && (
                          <span className="pattern-tag">PATTERN</span>
                        )}
                      </td>
                      <td className="num">{fmtNum(count)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quiet note */}
      {m.client_side_activity_total === 0 && (
        <div className="team-note">
          No file or product downloads were logged from the brand side this
          period. The work below reflects activity completed on the account
          regardless.
        </div>
      )}

      {/* Footer */}
      <div className="report-footer">
        <div className="footer-left">
          <svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="7.5" height="7.5" rx="1.5" fill="#8493A0" />
            <rect x="9.25" y="0" width="7.5" height="7.5" rx="1.5" fill="#8493A0" opacity="0.55" />
            <rect x="18.5" y="0" width="7.5" height="7.5" rx="1.5" fill="#8493A0" />
            <rect x="0" y="9.25" width="7.5" height="7.5" rx="1.5" fill="#8493A0" opacity="0.55" />
            <rect x="9.25" y="9.25" width="7.5" height="7.5" rx="1.5" fill="#8493A0" />
            <rect x="18.5" y="9.25" width="7.5" height="7.5" rx="1.5" fill="#8493A0" opacity="0.55" />
            <rect x="0" y="18.5" width="7.5" height="7.5" rx="1.5" fill="#8493A0" />
            <rect x="9.25" y="18.5" width="7.5" height="7.5" rx="1.5" fill="#8493A0" opacity="0.55" />
            <rect x="18.5" y="18.5" width="7.5" height="7.5" rx="1.5" fill="#8493A0" />
          </svg>
          <span>
            Prepared by {csmName} &middot; Pattern PXM Customer Success
          </span>
        </div>
        <div>Questions? Reach out anytime.</div>
      </div>
    </div>
  );
}
