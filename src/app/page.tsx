"use client";

import React, { useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { parseWorkbook, fmtDateShort } from "@/lib/parseWorkbook";
import Report from "@/components/Report";
import CompareReport from "@/components/CompareReport";
import type { Metrics, ReportConfig } from "@/lib/types";

type View = "form" | "report" | "compare";
type Mode = "single" | "compare";

function autoLabel(m: Metrics | null): string {
  if (!m || !m.period_start || !m.period_end) return "";
  return `${fmtDateShort(m.period_start)} – ${fmtDateShort(m.period_end)}`;
}

interface FileZoneProps {
  label: string;
  selectedFile: File | null;
  isDragging: boolean;
  onFile: (f: File) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function FileZone({
  label,
  selectedFile,
  isDragging,
  onFile,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  inputRef,
}: FileZoneProps) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--navy)", marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: isDragging
            ? "2px dashed var(--teal)"
            : selectedFile
              ? "2px solid var(--teal)"
              : "2px dashed #C7D0D4",
          borderRadius: 8,
          padding: 18,
          textAlign: "center" as const,
          color: isDragging ? "var(--teal)" : selectedFile ? "var(--teal)" : "var(--slate)",
          fontSize: 13,
          cursor: "pointer",
          background: isDragging || selectedFile ? "#F0F8F6" : "#FAFBFB",
          transition: "all 0.15s",
        }}
      >
        {selectedFile ? (
          <><strong>{selectedFile.name}</strong> — click to change</>
        ) : (
          <><strong style={{ color: "var(--navy)" }}>Click to choose</strong> or drag here</>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.length) onFile(e.target.files[0]); }}
      />
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("form");
  const [mode, setMode] = useState<Mode>("single");

  // Single mode state
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [config, setConfig] = useState<ReportConfig | null>(null);

  // Compare mode state
  const [metricsA, setMetricsA] = useState<Metrics | null>(null);
  const [metricsB, setMetricsB] = useState<Metrics | null>(null);
  const [labelAOverride, setLabelAOverride] = useState<string>("");
  const [labelBOverride, setLabelBOverride] = useState<string>("");
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [isDraggingA, setIsDraggingA] = useState(false);
  const [isDraggingB, setIsDraggingB] = useState(false);

  // Common state
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const brandNameRef = useRef<HTMLInputElement>(null);
  const csmNameRef = useRef<HTMLInputElement>(null);
  const teamNamesRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = useCallback((f: File): boolean => {
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setError("Please choose an .xlsx file.");
      return false;
    }
    setError(null);
    return true;
  }, []);

  const setFile = useCallback(
    (f: File) => {
      if (!validateAndSetFile(f)) return;
      setSelectedFile(f);
      if (brandNameRef.current && !brandNameRef.current.value) {
        const guess = f.name.split(/[_\-.]/)[0];
        brandNameRef.current.value =
          guess.charAt(0).toUpperCase() + guess.slice(1);
      }
    },
    [validateAndSetFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
    },
    [setFile]
  );

  const parseFile = (f: File): Promise<Metrics> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array", cellDates: true });
          resolve(parseWorkbook(wb));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("File read error"));
      reader.readAsArrayBuffer(f);
    });

  const buildConfig = (): ReportConfig => {
    const teamNames = new Set(
      (teamNamesRef.current?.value || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    return {
      brandName: brandNameRef.current?.value || "Brand",
      csmName: csmNameRef.current?.value || "Pattern",
      teamNames,
      customLogoDataUrl,
    };
  };

  const handleGenerate = async () => {
    setError(null);
    if (mode === "single") {
      if (!selectedFile) return;
      try {
        const m = await parseFile(selectedFile);
        setMetrics(m);
        setConfig(buildConfig());
        setView("report");
      } catch (err) {
        setError(
          "Could not parse this file: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    } else {
      if (!fileA || !fileB) {
        setError("Please choose both files for comparison.");
        return;
      }
      try {
        const [mA, mB] = await Promise.all([parseFile(fileA), parseFile(fileB)]);
        setMetricsA(mA);
        setMetricsB(mB);
        setConfig(buildConfig());
        setView("compare");
      } catch (err) {
        setError(
          "Could not parse one of the files: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomLogoDataUrl(ev.target?.result as string);
      setLogoFileName(f.name);
    };
    reader.readAsDataURL(f);
  };

  // Report view
  if (view === "report" && metrics && config) {
    return (
      <div style={{ background: "#eef1f2", minHeight: "100vh", padding: "28px 0" }}>
        <div
          className="no-print"
          style={{
            maxWidth: 816,
            margin: "0 auto 14px auto",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "0 16px",
          }}
        >
          <button onClick={() => setView("form")} style={backBtnStyle}>
            ← Edit / new file
          </button>
          <button onClick={() => window.print()} style={printBtnStyle}>
            Download as PDF
          </button>
        </div>
        <Report metrics={metrics} config={config} />
      </div>
    );
  }

  // Compare view
  if (view === "compare" && metricsA && metricsB && config) {
    const lA = labelAOverride || autoLabel(metricsA);
    const lB = labelBOverride || autoLabel(metricsB);
    return (
      <div style={{ background: "#eef1f2", minHeight: "100vh", padding: "28px 0" }}>
        <div
          className="no-print"
          style={{
            maxWidth: 816,
            margin: "0 auto 14px auto",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "0 16px",
          }}
        >
          <button onClick={() => setView("form")} style={backBtnStyle}>
            ← Edit / new files
          </button>
          <button onClick={() => window.print()} style={printBtnStyle}>
            Download as PDF
          </button>
        </div>
        <CompareReport
          metricsA={metricsA}
          metricsB={metricsB}
          labelA={lA}
          labelB={lB}
          config={config}
        />
      </div>
    );
  }

  // Form view
  return (
    <div
      style={{
        background: "#eef1f2",
        minHeight: "100vh",
        padding: 28,
        fontFamily: "Inter, -apple-system, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--grid)",
            borderRadius: 10,
            padding: "22px 26px",
          }}
        >
          <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "var(--navy)" }}>
            PXM Performance Report Generator
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--slate)", margin: "0 0 18px 0" }}>
            Upload a brand&apos;s activity-metrics export. Everything runs in your
            browser — the file never leaves your machine.
          </p>

          {/* Mode toggle */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Report type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["single", "compare"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  style={{
                    padding: "7px 16px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    borderRadius: 6,
                    border: "1px solid var(--grid)",
                    cursor: "pointer",
                    background: mode === m
                      ? "linear-gradient(90deg, var(--p-blue), var(--p-purple))"
                      : "#fff",
                    color: mode === m ? "#fff" : "var(--navy)",
                  }}
                >
                  {m === "single" ? "Single period" : "Compare two periods"}
                </button>
              ))}
            </div>
          </div>

          {/* Brand name + prepared by */}
          <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Brand name</label>
              <input
                ref={brandNameRef}
                type="text"
                placeholder="e.g. Bare Home"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Prepared by</label>
              <input
                ref={csmNameRef}
                type="text"
                placeholder="e.g. Paul"
                defaultValue="Paul"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Team names */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Your Pattern team members (optional)</label>
            <input
              ref={teamNamesRef}
              type="text"
              placeholder="comma-separated names, e.g. Amy Anagnos, Nick Manning"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 4 }}>
              Anyone listed here gets tagged &quot;Pattern&quot; in the contributor table,
              so client-side users aren&apos;t mistaken for your team&apos;s work.
            </div>
          </div>

          {/* Logo upload */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Company logo (optional)</label>
            <div
              onClick={() => logoInputRef.current?.click()}
              style={{
                border: logoFileName
                  ? "2px solid var(--teal)"
                  : "2px dashed #C7D0D4",
                borderRadius: 8,
                padding: "14px",
                textAlign: "center",
                color: logoFileName ? "var(--teal)" : "var(--slate)",
                fontSize: 13,
                cursor: "pointer",
                background: logoFileName ? "#F0F8F6" : "#FAFBFB",
              }}
            >
              {logoFileName ? (
                <><strong>{logoFileName}</strong> selected, click to change</>
              ) : (
                "Click to add your logo (PNG/SVG/JPG). Otherwise a default Pattern mark is used."
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleLogoChange}
            />
          </div>

          {/* File upload — single mode */}
          {mode === "single" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Activity export (.xlsx)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
                style={{
                  border: isDragging
                    ? "2px dashed var(--teal)"
                    : selectedFile
                      ? "2px solid var(--teal)"
                      : "2px dashed #C7D0D4",
                  borderRadius: 8,
                  padding: 26,
                  textAlign: "center",
                  color: isDragging ? "var(--teal)" : selectedFile ? "var(--teal)" : "var(--slate)",
                  fontSize: 13,
                  cursor: "pointer",
                  background: isDragging || selectedFile ? "#F0F8F6" : "#FAFBFB",
                  transition: "all 0.15s",
                }}
              >
                {selectedFile ? (
                  <><strong>{selectedFile.name}</strong> selected, click to change</>
                ) : (
                  <><strong style={{ color: "var(--navy)" }}>Click to choose a file</strong> or drag it here</>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.length) setFile(e.target.files[0]); }}
              />
            </div>
          )}

          {/* File upload — compare mode */}
          {mode === "compare" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Activity exports (.xlsx)</label>
              <div style={{ display: "flex", gap: 14 }}>
                <FileZone
                  label="Period A"
                  selectedFile={fileA}
                  isDragging={isDraggingA}
                  onFile={(f) => { if (validateAndSetFile(f)) setFileA(f); }}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingA(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setIsDraggingA(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDraggingA(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingA(false);
                    if (e.dataTransfer.files.length) {
                      const f = e.dataTransfer.files[0];
                      if (validateAndSetFile(f)) setFileA(f);
                    }
                  }}
                  inputRef={fileInputARef}
                />
                <FileZone
                  label="Period B"
                  selectedFile={fileB}
                  isDragging={isDraggingB}
                  onFile={(f) => { if (validateAndSetFile(f)) setFileB(f); }}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingB(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setIsDraggingB(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDraggingB(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingB(false);
                    if (e.dataTransfer.files.length) {
                      const f = e.dataTransfer.files[0];
                      if (validateAndSetFile(f)) setFileB(f);
                    }
                  }}
                  inputRef={fileInputBRef}
                />
              </div>

              {/* Label overrides */}
              <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, textTransform: "none", fontSize: 11 }}>
                    Period A label (optional — defaults to detected date range)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Q1 2025"
                    value={labelAOverride}
                    onChange={(e) => setLabelAOverride(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, textTransform: "none", fontSize: 11 }}>
                    Period B label (optional — defaults to detected date range)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Q2 2025"
                    value={labelBOverride}
                    onChange={(e) => setLabelBOverride(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={mode === "single" ? !selectedFile : !fileA || !fileB}
            style={{
              display: "inline-block",
              background:
                (mode === "single" ? selectedFile : fileA && fileB)
                  ? "linear-gradient(90deg, var(--p-blue), var(--p-purple))"
                  : "#AEB8BE",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: (mode === "single" ? selectedFile : fileA && fileB)
                ? "pointer"
                : "not-allowed",
              marginTop: 14,
              fontFamily: "inherit",
            }}
          >
            {mode === "single" ? "Generate report" : "Generate comparison"}
          </button>

          {error && (
            <div
              style={{
                background: "#FDECEC",
                border: "1px solid #F3C6C2",
                color: "#8A2E23",
                fontSize: 12.5,
                padding: "10px 14px",
                borderRadius: 6,
                marginTop: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--navy)",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--grid)",
  borderRadius: 5,
  fontSize: 13,
  fontFamily: "inherit",
  color: "var(--navy)",
  outline: "none",
};

const backBtnStyle: React.CSSProperties = {
  background: "#fff",
  color: "var(--navy)",
  border: "1px solid var(--grid)",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const printBtnStyle: React.CSSProperties = {
  background: "var(--navy)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
