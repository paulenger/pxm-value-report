"use client";

import React from "react";
import type { Metrics, ReportConfig } from "@/lib/types";
import { fmtNum, fmtDate } from "@/lib/parseWorkbook";

interface CompareReportProps {
  metricsA: Metrics;
  metricsB: Metrics;
  labelA: string;
  labelB: string;
  config: ReportConfig;
}

function delta(a: number, b: number): React.ReactNode {
  if (a === 0 && b === 0) return <span className="delta-neutral">-</span>;
  const diff = b - a;
  if (diff === 0) return <span className="delta-neutral">0</span>;
  const pct = a !== 0 ? Math.round((diff / a) * 100) : null;
  const pctStr = pct !== null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : "";
  const label = `${diff > 0 ? "+" : ""}${fmtNum(diff)}${pctStr}`;
  return (
    <span className={diff > 0 ? "delta-pos" : "delta-neg"}>{label}</span>
  );
}

interface CompareRow {
  label: string;
  a: number;
  b: number;
}

export default function CompareReport({
  metricsA: mA,
  metricsB: mB,
  labelA,
  labelB,
  config,
}: CompareReportProps) {
  const { brandName, csmName, customLogoDataUrl } = config;

  const nDaysA =
    mA.period_start && mA.period_end
      ? Math.round(
          (mA.period_end.getTime() - mA.period_start.getTime()) / 86400000
        ) + 1
      : 0;
  const nDaysB =
    mB.period_start && mB.period_end
      ? Math.round(
          (mB.period_end.getTime() - mB.period_start.getTime()) / 86400000
        ) + 1
      : 0;

  const synARateRaw = mA.syndications?.successRate ?? 0;
  const synBRateRaw = mB.syndications?.successRate ?? 0;
  const synARate = Math.round(synARateRaw * 100);
  const synBRate = Math.round(synBRateRaw * 100);

  const rows: CompareRow[] = [
    {
      label: "Total Platform Actions",
      a: mA.total_platform_actions,
      b: mB.total_platform_actions,
    },
    {
      label: "Files Uploaded",
      a: mA.files_uploaded?.total ?? 0,
      b: mB.files_uploaded?.total ?? 0,
    },
    {
      label: "Products Created",
      a: mA.products_created?.total ?? 0,
      b: mB.products_created?.total ?? 0,
    },
    {
      label: "Updates",
      a: mA.updates?.total ?? 0,
      b: mB.updates?.total ?? 0,
    },
    {
      label: "Imports",
      a: mA.imports?.total ?? 0,
      b: mB.imports?.total ?? 0,
    },
    {
      label: "Syndications",
      a: mA.syndications?.total ?? 0,
      b: mB.syndications?.total ?? 0,
    },
    {
      label: "Shares",
      a: mA.shares?.total ?? 0,
      b: mB.shares?.total ?? 0,
    },
    {
      label: "File Downloads",
      a: mA.file_downloads?.total ?? 0,
      b: mB.file_downloads?.total ?? 0,
    },
    {
      label: "Product Downloads",
      a: mA.product_downloads?.total ?? 0,
      b: mB.product_downloads?.total ?? 0,
    },
    {
      label: "File Shares",
      a: mA.file_shares?.total ?? 0,
      b: mB.file_shares?.total ?? 0,
    },
  ].filter((r) => r.a > 0 || r.b > 0);

  // Syndication success rate row (if either period has syndications)
  const showSynRate =
    (mA.syndications?.total ?? 0) > 0 || (mB.syndications?.total ?? 0) > 0;

  // Combined contributors
  const contribMap: Record<string, { a: number; b: number }> = {};
  for (const [name, count] of mA.top_contributors) {
    if (!contribMap[name]) contribMap[name] = { a: 0, b: 0 };
    contribMap[name].a += count;
  }
  for (const [name, count] of mB.top_contributors) {
    if (!contribMap[name]) contribMap[name] = { a: 0, b: 0 };
    contribMap[name].b += count;
  }
  const combinedContribs = Object.entries(contribMap)
    .map(([name, counts]) => ({ name, ...counts, total: counts.a + counts.b }))
    .sort((x, y) => y.total - x.total)
    .slice(0, 10);

  const FooterMark = () => (
    <svg viewBox="0 0 334 254" fill="none" style={{ width: 18, height: 14 }}>
      <path
        d="M2.35216 192.898L193.845 2.38697C196.982-0.733156 202.147-0.733156 205.283 2.38697L252.419 49.2806C255.555 52.4925 255.555 57.5398 252.419 60.6599L60.9255 251.171C57.697 254.291 52.6237 254.291 49.4875 251.171L2.35216 204.277C-0.784052 201.157-0.784052 196.018 2.35216 192.898Z"
        fill="#8493A0"
      />
      <path
        d="M160.087 192.9L272.714 80.8504C275.85 77.7302 281.015 77.7302 284.151 80.8504L331.287 127.744C334.423 130.956 334.423 136.003 331.287 139.123L218.66 251.172C215.432 254.293 210.358 254.293 207.222 251.172L160.087 204.279C156.951 201.159 156.951 196.02 160.087 192.9Z"
        fill="#8493A0"
        opacity="0.55"
      />
    </svg>
  );

  return (
    <div className="report-page" id="report-page">
      {/* Header band */}
      <div className="header-band">
        <div className="band-top-row">
          <div className="brand-lockup">
            {customLogoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="custom-logo" src={customLogoDataUrl} alt="Logo" />
            ) : (
              <>
                <div className="brand-badge">
                  <svg
                    viewBox="0 0 334 254"
                    fill="none"
                    style={{ width: 18, height: 14 }}
                  >
                    <path
                      d="M2.35216 192.898L193.845 2.38697C196.982-0.733156 202.147-0.733156 205.283 2.38697L252.419 49.2806C255.555 52.4925 255.555 57.5398 252.419 60.6599L60.9255 251.171C57.697 254.291 52.6237 254.291 49.4875 251.171L2.35216 204.277C-0.784052 201.157-0.784052 196.018 2.35216 192.898Z"
                      fill="white"
                    />
                    <path
                      d="M160.087 192.9L272.714 80.8504C275.85 77.7302 281.015 77.7302 284.151 80.8504L331.287 127.744C334.423 130.956 334.423 136.003 331.287 139.123L218.66 251.172C215.432 254.293 210.358 254.293 207.222 251.172L160.087 204.279C156.951 201.159 156.951 196.02 160.087 192.9Z"
                      fill="white"
                      opacity="0.7"
                    />
                  </svg>
                </div>
                <div className="brand-word">
                  Pattern<span> | PXM</span>
                </div>
              </>
            )}
          </div>
          <div className="compare-period-badges">
            <div className="period-badge">
              <strong>{labelA}</strong>
              <br />
              {fmtDate(mA.period_start)} &ndash; {fmtDate(mA.period_end)} (
              {nDaysA} days)
            </div>
            <div className="compare-vs">vs</div>
            <div className="period-badge">
              <strong>{labelB}</strong>
              <br />
              {fmtDate(mB.period_start)} &ndash; {fmtDate(mB.period_end)} (
              {nDaysB} days)
            </div>
          </div>
        </div>
        <div className="eyebrow">PXM Activity Comparison</div>
        <h1 className="report-h1">{brandName}</h1>
      </div>

      {/* Comparison table */}
      <div style={{ marginTop: 14, marginBottom: 14 }}>
        <div className="section-title">Metric Comparison</div>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>{labelA}</th>
              <th>{labelB}</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{fmtNum(r.a)}</td>
                <td className="num">{fmtNum(r.b)}</td>
                <td className="num">{delta(r.a, r.b)}</td>
              </tr>
            ))}
            {showSynRate && (
              <tr>
                <td>Syndication Success Rate</td>
                <td className="num">
                  {(mA.syndications?.total ?? 0) > 0 ? `${synARate}%` : "-"}
                </td>
                <td className="num">
                  {(mB.syndications?.total ?? 0) > 0 ? `${synBRate}%` : "-"}
                </td>
                <td className="num">
                  {(mA.syndications?.total ?? 0) > 0 &&
                  (mB.syndications?.total ?? 0) > 0 ? (
                    delta(synARate, synBRate)
                  ) : (
                    <span className="delta-neutral">-</span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Contributors section */}
      {combinedContribs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="section-title">Contributors</div>
          <table className="compare-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>{labelA}</th>
                <th>{labelB}</th>
                <th>Period</th>
              </tr>
            </thead>
            <tbody>
              {combinedContribs.map(({ name, a, b }) => {
                const onlyA = a > 0 && b === 0;
                const onlyB = a === 0 && b > 0;
                const tag = onlyA ? labelA : onlyB ? labelB : "Both";
                return (
                  <tr key={name}>
                    <td className="name">
                      {config.teamNames.has(String(name).toLowerCase()) ? (
                        <>
                          {name}
                          <span className="pattern-tag">PATTERN</span>
                        </>
                      ) : (
                        name
                      )}
                    </td>
                    <td className="num">{a > 0 ? fmtNum(a) : "-"}</td>
                    <td className="num">{b > 0 ? fmtNum(b) : "-"}</td>
                    <td
                      style={{
                        fontSize: 10,
                        color: "var(--slate)",
                        fontStyle: onlyA || onlyB ? "italic" : "normal",
                      }}
                    >
                      {tag}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="report-footer">
        <div className="footer-left">
          <FooterMark />
          <span>
            Prepared by {csmName} &middot; Pattern PXM Customer Success
          </span>
        </div>
        <div>Questions? Reach out anytime.</div>
      </div>
    </div>
  );
}
