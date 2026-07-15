"use client";

import React, { useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { parseWorkbook } from "@/lib/parseWorkbook";
import Report from "@/components/Report";
import type { Metrics, ReportConfig } from "@/lib/types";

type View = "form" | "report";

export default function Home() {
  const [view, setView] = useState<View>("form");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const brandNameRef = useRef<HTMLInputElement>(null);
  const csmNameRef = useRef<HTMLInputElement>(null);
  const teamNamesRef = useRef<HTMLInputElement>(null);

  const setFile = useCallback(
    (f: File) => {
      if (!f.name.toLowerCase().endsWith(".xlsx")) {
        setError("Please choose an .xlsx file.");
        return;
      }
      setSelectedFile(f);
      setError(null);
      if (brandNameRef.current && !brandNameRef.current.value) {
        const guess = f.name.split(/[_\-.]/)[0];
        brandNameRef.current.value =
          guess.charAt(0).toUpperCase() + guess.slice(1);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
    },
    [setFile]
  );

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

  const handleGenerate = () => {
    if (!selectedFile) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array", cellDates: true });
        const parsedMetrics = parseWorkbook(wb);
        const teamNames = new Set(
          (teamNamesRef.current?.value || "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        );
        const parsedConfig: ReportConfig = {
          brandName: brandNameRef.current?.value || "Brand",
          csmName: csmNameRef.current?.value || "Pattern",
          teamNames,
          customLogoDataUrl,
        };
        setMetrics(parsedMetrics);
        setConfig(parsedConfig);
        setView("report");
      } catch (err) {
        console.error(err);
        setError(
          "Could not parse this file: " +
            (err instanceof Error ? err.message : String(err)) +
            ". Make sure it matches the standard PXM activity-metrics export format."
        );
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  if (view === "report" && metrics && config) {
    return (
      <div style={{ background: "#eef1f2", minHeight: "100vh", padding: "28px 0" }}>
        {/* Toolbar */}
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
          <button
            onClick={() => setView("form")}
            style={{
              background: "#fff",
              color: "var(--navy)",
              border: "1px solid var(--grid)",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Edit / new file
          </button>
          <button
            onClick={() => window.print()}
            style={{
              background: "var(--navy)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Download as PDF
          </button>
        </div>
        <Report metrics={metrics} config={config} />
      </div>
    );
  }

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
            PXM Value Report Generator
          </h2>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--slate)",
              margin: "0 0 18px 0",
            }}
          >
            Upload a brand&apos;s activity-metrics export. Everything runs in your
            browser — the file never leaves your machine.
          </p>

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
                <>
                  <strong>{logoFileName}</strong> selected, click to change
                </>
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

          {/* File upload */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Activity export (.xlsx)</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
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
                color: isDragging
                  ? "var(--teal)"
                  : selectedFile
                    ? "var(--teal)"
                    : "var(--slate)",
                fontSize: 13,
                cursor: "pointer",
                background: isDragging || selectedFile ? "#F0F8F6" : "#FAFBFB",
                transition: "all 0.15s",
              }}
            >
              {selectedFile ? (
                <>
                  <strong>{selectedFile.name}</strong> selected, click to change
                </>
              ) : (
                <>
                  <strong style={{ color: "var(--navy)" }}>
                    Click to choose a file
                  </strong>{" "}
                  or drag it here
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.length) setFile(e.target.files[0]);
              }}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!selectedFile}
            style={{
              display: "inline-block",
              background: selectedFile
                ? "linear-gradient(90deg, var(--p-blue), var(--p-purple))"
                : "#AEB8BE",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: selectedFile ? "pointer" : "not-allowed",
              marginTop: 14,
              fontFamily: "inherit",
            }}
          >
            Generate report
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
