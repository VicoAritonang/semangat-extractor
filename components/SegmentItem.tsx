"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import katex from "katex";
import { toPng } from "html-to-image";
import {
  Copy,
  Download,
  Pencil,
  Check,
  Type,
  FileText,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import type { OutputSegment, AnalyzerItem } from "@/types";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

const MathEditor = dynamic(() => import("./MathEditor"), {
  ssr: false,
  loading: () => (
    <div className="math-editor">
      <div className="math-editor-field">
        <div className="math-editor-loading">
          <span>Loading editor...</span>
        </div>
      </div>
    </div>
  ),
});

interface SegmentItemProps {
  segment: OutputSegment;
  index: number;
  analyzerResult: AnalyzerItem | null;
  analyzerLoading: boolean;
  analyzerJustLoaded: boolean;
  onUpdate: (index: number, value: string) => void;
  onApplyRefinement: (index: number, latex: string) => void;
  showToast: (msg: string) => void;
}

function renderKatex(latex: string, displayMode: boolean = true): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      output: "html",
    });
  } catch {
    return `<span style="color: #ef4444;">Invalid LaTeX</span>`;
  }
}

// Convert LaTeX to Unicode approximation
function latexToUnicode(latex: string): string {
  const map: Record<string, string> = {
    "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
    "\\epsilon": "ε", "\\zeta": "ζ", "\\eta": "η", "\\theta": "θ",
    "\\iota": "ι", "\\kappa": "κ", "\\lambda": "λ", "\\mu": "μ",
    "\\nu": "ν", "\\xi": "ξ", "\\pi": "π", "\\rho": "ρ",
    "\\sigma": "σ", "\\tau": "τ", "\\upsilon": "υ", "\\phi": "φ",
    "\\chi": "χ", "\\psi": "ψ", "\\omega": "ω",
    "\\Gamma": "Γ", "\\Delta": "Δ", "\\Theta": "Θ", "\\Lambda": "Λ",
    "\\Xi": "Ξ", "\\Pi": "Π", "\\Sigma": "Σ", "\\Phi": "Φ",
    "\\Psi": "Ψ", "\\Omega": "Ω",
    "\\times": "×", "\\div": "÷", "\\pm": "±", "\\mp": "∓",
    "\\cdot": "·", "\\leq": "≤", "\\geq": "≥", "\\neq": "≠",
    "\\approx": "≈", "\\equiv": "≡", "\\sim": "∼",
    "\\infty": "∞", "\\partial": "∂", "\\nabla": "∇",
    "\\sum": "∑", "\\prod": "∏", "\\int": "∫",
    "\\in": "∈", "\\notin": "∉", "\\subset": "⊂", "\\cup": "∪", "\\cap": "∩",
    "\\forall": "∀", "\\exists": "∃", "\\emptyset": "∅",
    "\\rightarrow": "→", "\\leftarrow": "←", "\\Rightarrow": "⇒",
    "\\Leftarrow": "⇐", "\\implies": "⟹", "\\iff": "⟺",
    "\\to": "→",
    "\\left(": "(", "\\right)": ")", "\\left[": "[", "\\right]": "]",
    "\\left\\{": "{", "\\right\\}": "}", "\\left|": "|", "\\right|": "|",
    "\\quad": "  ", "\\,": " ",
  };

  let result = latex;
  for (const [key, val] of Object.entries(map)) {
    result = result.replaceAll(key, val);
  }

  // Handle superscripts
  const superMap: Record<string, string> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "n": "ⁿ", "i": "ⁱ", "+": "⁺", "-": "⁻",
  };
  result = result.replace(/\^{([^}]*)}/g, (_, content) => {
    return content.split("").map((c: string) => superMap[c] || c).join("");
  });

  // Handle subscripts
  const subMap: Record<string, string> = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    "i": "ᵢ", "n": "ₙ",
  };
  result = result.replace(/_{([^}]*)}/g, (_, content) => {
    return content.split("").map((c: string) => subMap[c] || c).join("");
  });

  // Handle fractions
  result = result.replace(/\\frac{([^}]*)}{([^}]*)}/g, "($1)/($2)");

  // Handle sqrt
  result = result.replace(/\\sqrt{([^}]*)}/g, "√($1)");
  result = result.replace(/\\sqrt\[([^\]]*)\]{([^}]*)}/g, "$1√($2)");

  // Remove remaining LaTeX commands
  result = result.replace(/\\(?:begin|end){[^}]*}/g, "");
  result = result.replace(/\\text{([^}]*)}/g, "$1");
  result = result.replace(/\\(?:mathbb|mathbf|mathcal|mathit|mathrm){([^}]*)}/g, "$1");
  result = result.replace(/\\(?:sin|cos|tan|log|ln|lim|det|max|min|exp)/g, (m) => m.replace("\\", ""));
  result = result.replace(/\\\\/g, "\n");
  result = result.replace(/&/g, " ");
  result = result.replace(/\\/g, "");

  return result.trim();
}

// Convert LaTeX to MathML for Word
function latexToMathML(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      output: "mathml",
    });
  } catch {
    return latex;
  }
}

export default function SegmentItem({
  segment,
  index,
  analyzerResult,
  analyzerLoading,
  analyzerJustLoaded,
  onUpdate,
  onApplyRefinement,
  showToast,
}: SegmentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(segment.value);
  const [showDownloadPicker, setShowDownloadPicker] = useState(false);
  const eqRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const isEquation = segment.type === "equation";

  // Close picker on outside click
  useEffect(() => {
    if (!showDownloadPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDownloadPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDownloadPicker]);

  const handleSave = useCallback(() => {
    onUpdate(index, editValue);
    setIsEditing(false);
  }, [index, editValue, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditValue(segment.value);
    setIsEditing(false);
  }, [segment.value]);

  const handleEdit = useCallback(() => {
    setEditValue(segment.value);
    setIsEditing(true);
  }, [segment.value]);

  const copyLatex = useCallback(() => {
    navigator.clipboard.writeText(segment.value);
    showToast("LaTeX copied! ✦");
  }, [segment.value, showToast]);

  const copyUnicode = useCallback(() => {
    const unicode = latexToUnicode(segment.value);
    navigator.clipboard.writeText(unicode);
    showToast("Unicode copied! ✦");
  }, [segment.value, showToast]);

  const copyWordEquation = useCallback(() => {
    const mathml = latexToMathML(segment.value);
    const blob = new Blob([mathml], { type: "text/html" });
    navigator.clipboard.write([
      new ClipboardItem({
        "text/html": blob,
        "text/plain": new Blob([segment.value], { type: "text/plain" }),
      }),
    ]);
    showToast("Word equation copied! ✦");
  }, [segment.value, showToast]);

  const saveAsImage = useCallback(async (bgColor: string) => {
    if (!eqRef.current) return;
    setShowDownloadPicker(false);
    try {
      const isWhiteBg = bgColor === "#ffffff";
      const dataUrl = await toPng(eqRef.current, {
        backgroundColor: bgColor,
        pixelRatio: 3,
        skipFonts: true,
        style: {
          padding: "20px",
          color: isWhiteBg ? "#000000" : "#f0f0ff",
        },
      });
      const link = document.createElement("a");
      link.download = `equation-${index + 1}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Image saved! ✦");
    } catch {
      showToast("Failed to save image");
    }
  }, [index, showToast]);

  return (
    <div
      className={`segment-container ${isEquation ? "segment-equation" : "segment-text-block"}`}
    >
      {/* Segment label */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className={`segment-label ${segment.type}`}>
          {isEquation ? <Star size={11} /> : <Type size={11} />}
          {isEquation ? "Equation" : "Text"} #{index + 1}
        </span>

        <AnimatePresence mode="wait">
          {!isEditing ? (
            <motion.button
              key="edit"
              className="btn-icon"
              onClick={handleEdit}
              title="Edit"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ rotate: 10 }}
              transition={{ duration: 0.2 }}
            >
              <Pencil size={14} />
            </motion.button>
          ) : (
            <motion.div
              key="save-cancel"
              style={{ display: "flex", gap: 4 }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <button
                className="btn-icon"
                onClick={handleSave}
                title="Save"
                style={{ borderColor: "rgba(16, 185, 129, 0.4)" }}
              >
                <Check size={14} color="#10b981" />
              </button>
              <button className="btn-icon" onClick={handleCancel} title="Cancel">
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Display or Edit */}
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            {isEquation ? (
              <MathEditor
                value={editValue}
                onChange={setEditValue}
                onClose={handleSave}
              />
            ) : (
              <textarea
                className="text-editor"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
            )}
          </motion.div>
        ) : isEquation ? (
          <motion.div
            key="display-eq"
            ref={eqRef}
            className="equation-display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: renderKatex(segment.value),
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="display-text"
            className="text-display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {segment.value}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons for equations */}
      {isEquation && !isEditing && (
        <motion.div
          className="segment-actions"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <button className="btn-secondary" onClick={copyLatex}>
            <Copy size={12} /> LaTeX
          </button>
          <button className="btn-secondary" onClick={copyUnicode}>
            <FileText size={12} /> Unicode
          </button>
          <button className="btn-secondary" onClick={copyWordEquation}>
            <Copy size={12} /> Word
          </button>
          <div style={{ position: "relative" }}>
            <button
              className="btn-secondary"
              onClick={() => setShowDownloadPicker(!showDownloadPicker)}
            >
              <Download size={12} /> Image
            </button>

            <AnimatePresence>
              {showDownloadPicker && (
                <motion.div
                  ref={pickerRef}
                  className="download-picker"
                  initial={{ opacity: 0, scale: 0.9, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="download-picker-header">
                    <span>Background color</span>
                    <button
                      className="download-picker-close"
                      onClick={() => setShowDownloadPicker(false)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="download-picker-options">
                    <button
                      className="download-picker-btn download-picker-black"
                      onClick={() => saveAsImage("#000000")}
                    >
                      <span className="download-picker-swatch" style={{ background: "#000" }} />
                      Black
                    </button>
                    <button
                      className="download-picker-btn download-picker-white"
                      onClick={() => saveAsImage("#ffffff")}
                    >
                      <span className="download-picker-swatch" style={{ background: "#fff" }} />
                      White
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Analyzer results for equations */}
      {isEquation && (
        <>
          <AnimatePresence>
            {analyzerLoading && (
              <motion.div
                className="analyzer-box"
                style={{ display: "flex", alignItems: "center", gap: 10 }}
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
              >
                <span className="loading-orbit" />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Analyzing equation across the cosmos...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {analyzerJustLoaded && analyzerResult && !analyzerLoading && (
              <motion.div
                className="analyzer-complete-flash"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Analysis complete!</span>
              </motion.div>
            )}
          </AnimatePresence>

          {analyzerResult && !analyzerLoading && (
            <motion.div
              className="analyzer-box"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
            >
              <div className="analyzer-title">
                <Sparkles size={13} /> AI Analysis
              </div>
              <div className="analyzer-value">
                <strong>Equation name:</strong> {analyzerResult.title}
              </div>
              {analyzerResult.explanation && (
                <motion.div
                  className="analyzer-explanation"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {analyzerResult.explanation}
                </motion.div>
              )}
              <div className="analyzer-eq">
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderKatex(analyzerResult.refinement),
                  }}
                />
              </div>
              <motion.button
                className="btn-use-refinement"
                onClick={() => onApplyRefinement(index, analyzerResult.refinement)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Sparkles size={12} /> Use this equation
              </motion.button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
