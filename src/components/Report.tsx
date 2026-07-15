"use client";

import React from "react";
import type { Metrics, ReportConfig } from "@/lib/types";
import { fmtNum, fmtDate } from "@/lib/parseWorkbook";

const STATUS_COLORS: Record<string, string> = {
  ACCEPTED: "#0096fa",
  "PARTIAL ACCEPTED": "#60c0ff",
  DRAFT: "#C9D2D6",
  "IN PROGRESS": "var(--amber)",
  REJECTED: "var(--red)",
  "API FAILURE": "var(--red-dark)",
};
const STATUS_ORDER = ["ACCEPTED","PARTIAL ACCEPTED","DRAFT","IN PROGRESS","REJECTED","API FAILURE"];

const SECTION_COLORS: Record<string, string> = {
  Updates: "#0096fa",
  Imports: "#770bff",
  Syndications: "#1e8a78",
  "Files Uploaded": "#d98e2b",
  "Products Created": "#d98e2b",
  Shares: "#770bff",
  "File Downloads": "#0096fa",
  "Product Downloads": "#1e8a78",
  "File Shares": "#5b6b76",
};

interface ReportProps { metrics: Metrics; config: ReportConfig; }

function SectionHeader({ title }: { title: string }) {
  const color = SECTION_COLORS[title] || "#0096fa";
  return (
    <div className="sheet-section-header" style={{ borderLeft: `3px solid ${color}` }}>
      {title}
    </div>
  );
}

function BreakdownTable({ entries, limit, minRows = 1 }: { entries: [string, number][]; limit?: number; minRows?: number }) {
  const rows = limit ? entries.slice(0, limit) : entries;
  if (rows.length <= minRows) return null;
  return (
    <table className="detail-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td className="num">{fmtNum(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContributorsTable({ contributors, teamNames, sectionTotal, limit = 6 }: { contributors: [string, number][]; teamNames: Set<string>; sectionTotal?: number; limit?: number }) {
  if (!contributors.length) return null;
  const visible = contributors.slice(0, limit);
  const total = sectionTotal ?? visible.reduce((s, [, n]) => s + n, 0);
  return (
    <table className="detail-table">
      <tbody>
        {visible.map(([name, count]) => {
          const isTeam = teamNames.has(String(name).toLowerCase());
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <tr key={name}>
              <td className="name">{name}{isTeam && <span className="pattern-tag">PATTERN</span>}</td>
              <td className="num">{fmtNum(count)}</td>
              <td className="pct">{pct}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function Report({ metrics: m, config }: ReportProps) {
  const { brandName, csmName, teamNames, customLogoDataUrl } = config;

  const nDays = m.period_start && m.period_end
    ? Math.round((m.period_end.getTime() - m.period_start.getTime()) / 86400000) + 1
    : 0;

  // Weekly bar chart
  const maxVal = Math.max(1, ...m.weekly_activity.map(([, v]) => v));
  const bars = m.weekly_activity.map(([key, val]) => {
    const d = new Date(key + "T00:00:00");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { label, val, h: Math.max(8, Math.round((val / maxVal) * 44)) };
  });

  // Syndication donut
  const syn = m.syndications;
  const hasSyndication = !!syn && syn.total > 0;
  let donutGradient = "#E4E8EA";
  let acceptedPct = 0;
  if (hasSyndication && syn) {
    let cum = 0;
    const stops: string[] = [];
    for (const status of STATUS_ORDER) {
      const v = syn.byStatus[status] || 0;
      if (!v) continue;
      const start = (cum / syn.total) * 100;
      cum += v;
      stops.push(`${STATUS_COLORS[status]} ${start}% ${(cum / syn.total) * 100}%`);
    }
    donutGradient = stops.length ? `conic-gradient(${stops.join(",")})` : "#E4E8EA";
    acceptedPct = Math.round(
      ((syn.byStatus["ACCEPTED"] || 0) + (syn.byStatus["PARTIAL ACCEPTED"] || 0)) / syn.total * 100
    );
  }

  // ---- User-initiated updates (exclude system generated) ----
  const humanUpdates = m.updates
    ? m.updates.byAction
        .filter(([k]) => k.toLowerCase() !== "system generated")
        .reduce((s, [, v]) => s + v, 0)
    : 0;

  // Subtract system-generated updates from displayed total
  const displayedTotal = m.total_platform_actions - (m.updates ? m.updates.total - humanUpdates : 0);

  // ---- Auto-generated highlights ----
  const highlights: string[] = [];
  if (bars.length > 0) {
    const peak = bars.reduce((best, b) => b.val > best.val ? b : best);
    highlights.push(`${peak.label} was the busiest week with ${fmtNum(peak.val)} platform actions`);
  }
  if (m.files_uploaded && m.files_uploaded.total > 0 && nDays > 0) {
    const rate = (m.files_uploaded.total / nDays).toFixed(1);
    highlights.push(`${fmtNum(m.files_uploaded.total)} files uploaded at a ${rate}/day pace over the ${nDays}-day period`);
  }
  if (humanUpdates > 0) {
    highlights.push(`${fmtNum(humanUpdates)} user-initiated product update${humanUpdates !== 1 ? "s" : ""} recorded by your team this period`);
  }
  if (hasSyndication && syn) {
    highlights.push(`${acceptedPct}% syndication acceptance rate across ${fmtNum(syn.total)} syndication events`);
  }
  if (highlights.length < 2 && m.top_contributors.length > 0) {
    const [name, count] = m.top_contributors[0];
    highlights.push(`${name} was the top contributor with ${fmtNum(count)} recorded actions this period`);
  }

  // ---- Secondary KPI pills ----
  const secondaryKpis = [
    m.files_uploaded?.total ? { label: "Files Uploaded", value: m.files_uploaded.total } : null,
    m.products_created?.total ? { label: "Products Created", value: m.products_created.total } : null,
    m.updates && humanUpdates > 0 ? { label: "Updates", value: humanUpdates } : null,
    m.imports?.total ? { label: "Imports", value: m.imports.total } : null,
    m.syndications?.total ? { label: "Syndications", value: m.syndications.total } : null,
    m.shares?.total ? { label: "Shares", value: m.shares.total } : null,
    m.file_downloads?.total ? { label: "File Downloads", value: m.file_downloads.total } : null,
    m.product_downloads?.total ? { label: "Product Downloads", value: m.product_downloads.total } : null,
  ].filter(Boolean) as { label: string; value: number }[];

  const FooterMark = () => (
    <svg viewBox="0 0 334 254" fill="none" style={{ width: 18, height: 14 }}>
      <path d="M2.35216 192.898L193.845 2.38697C196.982-0.733156 202.147-0.733156 205.283 2.38697L252.419 49.2806C255.555 52.4925 255.555 57.5398 252.419 60.6599L60.9255 251.171C57.697 254.291 52.6237 254.291 49.4875 251.171L2.35216 204.277C-0.784052 201.157-0.784052 196.018 2.35216 192.898Z" fill="#8493A0" />
      <path d="M160.087 192.9L272.714 80.8504C275.85 77.7302 281.015 77.7302 284.151 80.8504L331.287 127.744C334.423 130.956 334.423 136.003 331.287 139.123L218.66 251.172C215.432 254.293 210.358 254.293 207.222 251.172L160.087 204.279C156.951 201.159 156.951 196.02 160.087 192.9Z" fill="#8493A0" opacity="0.55" />
    </svg>
  );

  return (
    <div className="report-page" id="report-page">

      {/* ── Header ── */}
      <div className="header-band">
        <div className="band-top-row">
          <div className="brand-lockup">
            {customLogoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="custom-logo" src={customLogoDataUrl} alt="Logo" />
            ) : (
              <>
                <div className="brand-badge">
                  <svg viewBox="0 0 334 254" fill="none" style={{ width: 18, height: 14 }}>
                    <path d="M2.35216 192.898L193.845 2.38697C196.982-0.733156 202.147-0.733156 205.283 2.38697L252.419 49.2806C255.555 52.4925 255.555 57.5398 252.419 60.6599L60.9255 251.171C57.697 254.291 52.6237 254.291 49.4875 251.171L2.35216 204.277C-0.784052 201.157-0.784052 196.018 2.35216 192.898Z" fill="white" />
                    <path d="M160.087 192.9L272.714 80.8504C275.85 77.7302 281.015 77.7302 284.151 80.8504L331.287 127.744C334.423 130.956 334.423 136.003 331.287 139.123L218.66 251.172C215.432 254.293 210.358 254.293 207.222 251.172L160.087 204.279C156.951 201.159 156.951 196.02 160.087 192.9Z" fill="white" opacity="0.7" />
                  </svg>
                </div>
                <div className="brand-word">Pattern<span> | PXM</span></div>
              </>
            )}
          </div>
          <div className="period-badge">
            Reporting period<br />
            <strong>{fmtDate(m.period_start)} &ndash; {fmtDate(m.period_end)}</strong> ({nDays} days)
          </div>
        </div>
        <div className="eyebrow">PXM Activity Summary</div>
        <h1 className="report-h1">{brandName}</h1>

        {/* KPI stats inside the header band */}
        <div className="header-kpi-row">
          <div className="header-kpi-primary">
            <div className="header-kpi-num">{fmtNum(displayedTotal)}</div>
            <div className="header-kpi-unit">Total platform actions</div>
          </div>
          {secondaryKpis.length > 0 && (
            <>
              <div className="header-kpi-divider" />
              <div className="header-kpi-secondary">
                {secondaryKpis.map((k) => (
                  <div key={k.label} className="header-kpi-sec-item">
                    <span className="header-kpi-sec-num">{fmtNum(k.value)}</span>
                    <span className="header-kpi-sec-label">{k.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Key Highlights ── */}
      {highlights.length > 0 && (
        <div className="highlights-box">
          <div className="highlights-label">Key Highlights</div>
          {highlights.map((h, i) => (
            <div key={i} className="highlight-item">
              <span className="highlight-arrow">&rarr;</span>
              <span>{h}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Weekly activity chart ── */}
      {bars.length > 0 && (
        <div style={{ marginBottom: 10 }}>
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
            {bars.map((b, i) => <div key={i}>{b.label}</div>)}
          </div>
          <div className="chart-caption">
            All platform activity by week: updates, imports, syndications, file uploads, and downloads.
          </div>
        </div>
      )}

      {/* ── Updates ── */}
      {m.updates && (
        <div className="sheet-section">
          <SectionHeader title="Updates" />
          <div className="sheet-section-body">
            <div className="sheet-stat-row">
              <div className="sheet-stat">
                <div className="sheet-stat-num">{fmtNum(humanUpdates)}</div>
                <div className="sheet-stat-label">user-initiated updates</div>
              </div>
            </div>
            <div className="detail-grid">
              {m.updates.byAction.filter(([k]) => k.toLowerCase() !== "system generated").length > 0 && (
                <div className="detail-block">
                  <div className="section-title">By Update Action</div>
                  <BreakdownTable entries={m.updates.byAction.filter(([k]) => k.toLowerCase() !== "system generated")} />
                </div>
              )}
              {m.updates.byChangeSource.length > 0 &&
                JSON.stringify(m.updates.byChangeSource) !== JSON.stringify(m.updates.byAction) && (
                  <div className="detail-block">
                    <div className="section-title">By Change Source</div>
                    <BreakdownTable entries={m.updates.byChangeSource} />
                  </div>
                )}
              {m.updates.contributors.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">Contributors</div>
                  <ContributorsTable
                    contributors={m.updates.contributors}
                    teamNames={teamNames}
                    sectionTotal={m.updates.byAction.filter(([k]) => k.toLowerCase() !== "system generated").reduce((s, [, v]) => s + v, 0)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Imports ── */}
      {m.imports && (
        <div className="sheet-section">
          <SectionHeader title="Imports" />
          <div className="sheet-section-body">
            <div className="sheet-stat-row">
              <div className="sheet-stat">
                <div className="sheet-stat-num">{fmtNum(m.imports.total)}</div>
                <div className="sheet-stat-label">import jobs processed</div>
              </div>
              {m.imports.processedTotal > 0 && (
                <div className="sheet-callout">
                  <span className="sheet-callout-num">{fmtNum(m.imports.processedTotal)}</span> records ingested
                </div>
              )}
            </div>
            <div className="detail-grid">
              {m.imports.byType.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">By Import Type</div>
                  <BreakdownTable entries={m.imports.byType} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Syndications ── */}
      {m.syndications && (
        <div className="sheet-section">
          <SectionHeader title="Syndications" />
          <div className="sheet-section-body">
            <div className="sheet-stat-row">
              <div className="sheet-stat">
                <div className="sheet-stat-num">{fmtNum(m.syndications.total)}</div>
                <div className="sheet-stat-label">syndication events</div>
              </div>
              <div className="sheet-stat">
                <div className="sheet-stat-num">{Math.round(m.syndications.successRate * 100)}%</div>
                <div className="sheet-stat-label">acceptance rate</div>
              </div>
            </div>
            <div className="detail-grid">
              {hasSyndication && syn && (
                <div className="detail-block">
                  <div className="section-title">Syndication Outcomes</div>
                  <div className="donut-wrap">
                    <div style={{ position: "relative", width: 106, height: 106 }}>
                      <div className="donut" style={{ background: donutGradient }} />
                      <div className="donut-center">
                        <div className="pct">{acceptedPct}%</div>
                        <div className="pctlabel">accepted</div>
                      </div>
                    </div>
                    <div className="donut-legend">
                      <div><b>{fmtNum(syn.total)}</b> total events</div>
                      <div><b>{fmtNum(syn.byStatus["ACCEPTED"] || 0)}</b> fully accepted</div>
                      <div><b>{fmtNum(syn.byStatus["PARTIAL ACCEPTED"] || 0)}</b> partially accepted</div>
                      <div><b>{fmtNum((syn.byStatus["REJECTED"] || 0) + (syn.byStatus["API FAILURE"] || 0))}</b> rejected / failed</div>
                    </div>
                  </div>
                </div>
              )}
              {m.syndications.bySyndicationType.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">By Syndication Type</div>
                  <BreakdownTable entries={m.syndications.bySyndicationType} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Files Uploaded ── */}
      {m.files_uploaded && (
        <div className="sheet-section">
          <SectionHeader title="Files Uploaded" />
          <div className="sheet-section-body">
            <div className="sheet-stat-row">
              <div className="sheet-stat">
                <div className="sheet-stat-num">{fmtNum(m.files_uploaded.total)}</div>
                <div className="sheet-stat-label">files uploaded</div>
              </div>
              {nDays > 0 && (
                <div className="sheet-callout">
                  <span className="sheet-callout-num">
                    {(m.files_uploaded.total / nDays).toFixed(1)}
                  </span>{" "}
                  files per day average
                </div>
              )}
            </div>
            {m.files_uploaded.byDomain.length > 0 && (
              <div className="detail-grid">
                <div className="detail-block">
                  <div className="section-title">By Domain</div>
                  <BreakdownTable entries={m.files_uploaded.byDomain} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Products Created ── */}
      {m.products_created && (
        <div className="sheet-section">
          <SectionHeader title="Products Created" />
          <div className="sheet-section-body">
            <div className="sheet-stat-row">
              <div className="sheet-stat">
                <div className="sheet-stat-num">{fmtNum(m.products_created.total)}</div>
                <div className="sheet-stat-label">products created</div>
              </div>
            </div>
            {m.products_created.byDomain.length > 0 && (
              <div className="detail-grid">
                <div className="detail-block">
                  <div className="section-title">By Domain</div>
                  <BreakdownTable entries={m.products_created.byDomain} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Shares ── */}
      {m.shares && (
        <div className="sheet-section">
          <SectionHeader title="Shares" />
          <div className="sheet-section-body">
            <div className="sheet-stat-row">
              <div className="sheet-stat">
                <div className="sheet-stat-num">{fmtNum(m.shares.total)}</div>
                <div className="sheet-stat-label">share events</div>
              </div>
            </div>
            <div className="detail-grid">
              {m.shares.byAction.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">By Action</div>
                  <BreakdownTable entries={m.shares.byAction} />
                </div>
              )}
              {m.shares.contributors.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">Contributors</div>
                  <ContributorsTable contributors={m.shares.contributors} teamNames={teamNames} sectionTotal={m.shares.total} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── File Downloads ── */}
      {m.file_downloads && (
        <div className="sheet-section">
          <SectionHeader title="File Downloads" />
          <div className="sheet-section-body">
            <div className="sheet-stat-row">
              <div className="sheet-stat">
                <div className="sheet-stat-num">{fmtNum(m.file_downloads.total)}</div>
                <div className="sheet-stat-label">file downloads by clients</div>
              </div>
            </div>
            <div className="detail-grid">
              {m.file_downloads.byFileName.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">Most Downloaded Files</div>
                  <BreakdownTable entries={m.file_downloads.byFileName} />
                </div>
              )}
              {/* Only show By Type if there are multiple types */}
              {m.file_downloads.byType.length > 1 && (
                <div className="detail-block">
                  <div className="section-title">By File Type</div>
                  <BreakdownTable entries={m.file_downloads.byType} />
                </div>
              )}
              {m.file_downloads.contributors.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">Downloaded By</div>
                  <ContributorsTable contributors={m.file_downloads.contributors} teamNames={teamNames} sectionTotal={m.file_downloads.total} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Product Downloads ── */}
      {m.product_downloads && (
        <div className="sheet-section">
          <SectionHeader title="Product Downloads" />
          <div className="sheet-section-body">
            <div className="sheet-stat-row">
              <div className="sheet-stat">
                <div className="sheet-stat-num">{fmtNum(m.product_downloads.total)}</div>
                <div className="sheet-stat-label">product downloads</div>
              </div>
            </div>
            <div className="detail-grid">
              {m.product_downloads.byProductName.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">Top Products</div>
                  <BreakdownTable entries={m.product_downloads.byProductName} />
                </div>
              )}
              {m.product_downloads.contributors.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">Downloaded By</div>
                  <ContributorsTable contributors={m.product_downloads.contributors} teamNames={teamNames} sectionTotal={m.product_downloads.total} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── File Shares ── */}
      {m.file_shares && (
        <div className="sheet-section">
          <SectionHeader title="File Shares" />
          <div className="sheet-section-body">
            <div className="sheet-stat-row">
              <div className="sheet-stat">
                <div className="sheet-stat-num">{fmtNum(m.file_shares.total)}</div>
                <div className="sheet-stat-label">file share events</div>
              </div>
            </div>
            <div className="detail-grid">
              {m.file_shares.byShareType.length > 1 && (
                <div className="detail-block">
                  <div className="section-title">By Share Type</div>
                  <BreakdownTable entries={m.file_shares.byShareType} />
                </div>
              )}
              {m.file_shares.bySender.length > 0 && (
                <div className="detail-block">
                  <div className="section-title">Shared By</div>
                  <BreakdownTable entries={m.file_shares.bySender} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="report-footer">
        <div className="footer-left">
          <FooterMark />
          <span>Prepared by {csmName} &middot; Pattern PXM Customer Success</span>
        </div>
        <div>Questions? Reach out anytime.</div>
      </div>
    </div>
  );
}
