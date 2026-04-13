"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import katex from "katex";
import {
  ChevronLeft,
  ChevronRight,
  Delete,
  Eraser,
  Code2,
  Check,
} from "lucide-react";

interface LaTeXKeyboardProps {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
}

interface KeyDef {
  label: string;
  latex: string;
  display?: string;
}

const CATEGORIES: Record<string, KeyDef[]> = {
  "Common": [
    { label: "+", latex: "+" },
    { label: "−", latex: "-" },
    { label: "×", latex: "\\times " },
    { label: "÷", latex: "\\div " },
    { label: "=", latex: "=" },
    { label: "≠", latex: "\\neq " },
    { label: "<", latex: "<" },
    { label: ">", latex: ">" },
    { label: "≤", latex: "\\leq " },
    { label: "≥", latex: "\\geq " },
    { label: "±", latex: "\\pm " },
    { label: "∓", latex: "\\mp " },
    { label: "·", latex: "\\cdot " },
    { label: "…", latex: "\\cdots " },
    { label: "()", latex: "\\left(  \\right)" },
    { label: "[]", latex: "\\left[  \\right]" },
    { label: "{}", latex: "\\left\\{  \\right\\}" },
    { label: "||", latex: "\\left|  \\right|" },
    { label: "∞", latex: "\\infty " },
    { label: "⁻¹", latex: "^{-1}" },
  ],
  "Frac": [
    { label: "a/b", latex: "\\frac{}{}", display: "\\frac{a}{b}" },
    { label: "^", latex: "^{}" },
    { label: "_", latex: "_{}" },
    { label: "a^b", latex: "^{}", display: "a^{b}" },
    { label: "a_b", latex: "_{}", display: "a_{b}" },
    { label: "√", latex: "\\sqrt{}" },
    { label: "ⁿ√", latex: "\\sqrt[]{}", display: "\\sqrt[n]{x}" },
    { label: "x²", latex: "^{2}", display: "x^{2}" },
    { label: "x³", latex: "^{3}", display: "x^{3}" },
    { label: "xⁿ", latex: "^{n}", display: "x^{n}" },
    { label: "eˣ", latex: "e^{}", display: "e^{x}" },
    { label: "10ˣ", latex: "10^{}", display: "10^{x}" },
    { label: "log", latex: "\\log " },
    { label: "ln", latex: "\\ln " },
    { label: "log₂", latex: "\\log_{2} " },
    { label: "logₙ", latex: "\\log_{} ", display: "\\log_{n}" },
  ],
  "Greek": [
    { label: "α", latex: "\\alpha " },
    { label: "β", latex: "\\beta " },
    { label: "γ", latex: "\\gamma " },
    { label: "Γ", latex: "\\Gamma " },
    { label: "δ", latex: "\\delta " },
    { label: "Δ", latex: "\\Delta " },
    { label: "ε", latex: "\\epsilon " },
    { label: "ζ", latex: "\\zeta " },
    { label: "η", latex: "\\eta " },
    { label: "θ", latex: "\\theta " },
    { label: "Θ", latex: "\\Theta " },
    { label: "ι", latex: "\\iota " },
    { label: "κ", latex: "\\kappa " },
    { label: "λ", latex: "\\lambda " },
    { label: "Λ", latex: "\\Lambda " },
    { label: "μ", latex: "\\mu " },
    { label: "ν", latex: "\\nu " },
    { label: "ξ", latex: "\\xi " },
    { label: "Ξ", latex: "\\Xi " },
    { label: "π", latex: "\\pi " },
    { label: "Π", latex: "\\Pi " },
    { label: "ρ", latex: "\\rho " },
    { label: "σ", latex: "\\sigma " },
    { label: "Σ", latex: "\\Sigma " },
    { label: "τ", latex: "\\tau " },
    { label: "υ", latex: "\\upsilon " },
    { label: "φ", latex: "\\phi " },
    { label: "Φ", latex: "\\Phi " },
    { label: "χ", latex: "\\chi " },
    { label: "ψ", latex: "\\psi " },
    { label: "Ψ", latex: "\\Psi " },
    { label: "ω", latex: "\\omega " },
    { label: "Ω", latex: "\\Omega " },
  ],
  "Calc": [
    { label: "∫", latex: "\\int " },
    { label: "∫ab", latex: "\\int_{a}^{b} ", display: "\\int_{a}^{b}" },
    { label: "∬", latex: "\\iint " },
    { label: "∭", latex: "\\iiint " },
    { label: "∮", latex: "\\oint " },
    { label: "∂", latex: "\\partial " },
    { label: "d/dx", latex: "\\frac{d}{dx} ", display: "\\frac{d}{dx}" },
    { label: "∂/∂x", latex: "\\frac{\\partial}{\\partial x} ", display: "\\frac{\\partial}{\\partial x}" },
    { label: "∑", latex: "\\sum " },
    { label: "∑ab", latex: "\\sum_{i=0}^{n} ", display: "\\sum_{i=0}^{n}" },
    { label: "∏", latex: "\\prod " },
    { label: "∏ab", latex: "\\prod_{i=0}^{n} ", display: "\\prod_{i=0}^{n}" },
    { label: "lim", latex: "\\lim " },
    { label: "lim→", latex: "\\lim_{x \\to } ", display: "\\lim_{x \\to a}" },
    { label: "→", latex: "\\to " },
    { label: "∇", latex: "\\nabla " },
    { label: "dx", latex: "\\,dx " },
    { label: "dy", latex: "\\,dy " },
    { label: "dt", latex: "\\,dt " },
  ],
  "Trig": [
    { label: "sin", latex: "\\sin " },
    { label: "cos", latex: "\\cos " },
    { label: "tan", latex: "\\tan " },
    { label: "csc", latex: "\\csc " },
    { label: "sec", latex: "\\sec " },
    { label: "cot", latex: "\\cot " },
    { label: "sin⁻¹", latex: "\\sin^{-1} ", display: "\\sin^{-1}" },
    { label: "cos⁻¹", latex: "\\cos^{-1} ", display: "\\cos^{-1}" },
    { label: "tan⁻¹", latex: "\\tan^{-1} ", display: "\\tan^{-1}" },
    { label: "sinh", latex: "\\sinh " },
    { label: "cosh", latex: "\\cosh " },
    { label: "tanh", latex: "\\tanh " },
    { label: "°", latex: "^{\\circ}" },
  ],
  "Matrix": [
    { label: "2×2", latex: "\\begin{pmatrix}  &  \\\\  &  \\end{pmatrix}", display: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
    { label: "3×3", latex: "\\begin{pmatrix}  &  &  \\\\  &  &  \\\\  &  &  \\end{pmatrix}", display: "\\begin{pmatrix} \\cdot & \\cdot & \\cdot \\\\ \\cdot & \\cdot & \\cdot \\\\ \\cdot & \\cdot & \\cdot \\end{pmatrix}" },
    { label: "[2×2]", latex: "\\begin{bmatrix}  &  \\\\  &  \\end{bmatrix}", display: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
    { label: "det", latex: "\\det " },
    { label: "vec", latex: "\\vec{}" },
    { label: "hat", latex: "\\hat{}" },
    { label: "bar", latex: "\\bar{}" },
    { label: "dot", latex: "\\dot{}" },
    { label: "ddot", latex: "\\ddot{}" },
    { label: "tilde", latex: "\\tilde{}" },
  ],
  "Sets": [
    { label: "∈", latex: "\\in " },
    { label: "∉", latex: "\\notin " },
    { label: "⊂", latex: "\\subset " },
    { label: "⊆", latex: "\\subseteq " },
    { label: "⊃", latex: "\\supset " },
    { label: "∪", latex: "\\cup " },
    { label: "∩", latex: "\\cap " },
    { label: "∅", latex: "\\emptyset " },
    { label: "ℝ", latex: "\\mathbb{R} " },
    { label: "ℤ", latex: "\\mathbb{Z} " },
    { label: "ℕ", latex: "\\mathbb{N} " },
    { label: "ℂ", latex: "\\mathbb{C} " },
    { label: "ℚ", latex: "\\mathbb{Q} " },
    { label: "∀", latex: "\\forall " },
    { label: "∃", latex: "\\exists " },
    { label: "¬", latex: "\\neg " },
    { label: "∧", latex: "\\land " },
    { label: "∨", latex: "\\lor " },
    { label: "⟹", latex: "\\implies " },
    { label: "⟺", latex: "\\iff " },
  ],
  "Arrows": [
    { label: "→", latex: "\\rightarrow " },
    { label: "←", latex: "\\leftarrow " },
    { label: "↔", latex: "\\leftrightarrow " },
    { label: "⇒", latex: "\\Rightarrow " },
    { label: "⇐", latex: "\\Leftarrow " },
    { label: "⇔", latex: "\\Leftrightarrow " },
    { label: "↑", latex: "\\uparrow " },
    { label: "↓", latex: "\\downarrow " },
    { label: "↦", latex: "\\mapsto " },
    { label: "≈", latex: "\\approx " },
    { label: "≡", latex: "\\equiv " },
    { label: "∝", latex: "\\propto " },
    { label: "∼", latex: "\\sim " },
    { label: "≅", latex: "\\cong " },
  ],
  "Layout": [
    { label: "aligned", latex: "\\begin{aligned}\n\n\\end{aligned}" },
    { label: "cases", latex: "\\begin{cases}\n\n\\end{cases}" },
    { label: "array", latex: "\\begin{array}{}\n\n\\end{array}" },
    { label: "&", latex: "& " },
    { label: "\\\\", latex: "\\\\\n" },
    { label: "text", latex: "\\text{}" },
    { label: "space", latex: "\\quad " },
    { label: "thin", latex: "\\, " },
    { label: "bold", latex: "\\mathbf{}" },
    { label: "italic", latex: "\\mathit{}" },
    { label: "cal", latex: "\\mathcal{}" },
    { label: "hat", latex: "\\hat{}" },
    { label: "overline", latex: "\\overline{}" },
    { label: "underline", latex: "\\underline{}" },
    { label: "overbrace", latex: "\\overbrace{}^{}" },
    { label: "underbrace", latex: "\\underbrace{}_{}" },
  ],
};

function renderKatexSafe(latex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      output: "html",
    });
  } catch {
    return `<span style="color: rgba(200,200,240,0.4); font-style: italic;">Type an equation...</span>`;
  }
}

export default function LaTeXKeyboard({ value, onChange, onClose }: LaTeXKeyboardProps) {
  const [activeTab, setActiveTab] = useState("Common");
  const [showRaw, setShowRaw] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState(value.length);

  useEffect(() => {
    if (textareaRef.current && showRaw) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(cursorPos, cursorPos);
    }
  }, [cursorPos, showRaw]);

  const insertLatex = useCallback(
    (latex: string) => {
      const pos = cursorPos;
      const before = value.substring(0, pos);
      const after = value.substring(pos);
      const newValue = before + latex + after;
      onChange(newValue);
      const newPos = pos + latex.length;
      setCursorPos(newPos);
    },
    [value, onChange, cursorPos]
  );

  const handleBackspace = useCallback(() => {
    if (cursorPos <= 0) return;
    const before = value.substring(0, cursorPos - 1);
    const after = value.substring(cursorPos);
    onChange(before + after);
    setCursorPos(cursorPos - 1);
  }, [value, onChange, cursorPos]);

  const handleCursorLeft = useCallback(() => {
    setCursorPos((p) => Math.max(0, p - 1));
  }, []);

  const handleCursorRight = useCallback(() => {
    setCursorPos((p) => Math.min(value.length, p + 1));
  }, [value.length]);

  const handleClear = useCallback(() => {
    onChange("");
    setCursorPos(0);
  }, [onChange]);

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Live preview
  const previewHtml = renderKatexSafe(value || " ", true);

  return (
    <motion.div
      className="eq-editor"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ─── Large rendered preview ─── */}
      <div className="eq-editor-preview">
        {value ? (
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        ) : (
          <span className="eq-editor-placeholder">
            Press symbols below to build your equation
          </span>
        )}
      </div>

      {/* ─── Toolbar: cursor, backspace, clear, raw toggle ─── */}
      <div className="eq-editor-toolbar">
        <div className="eq-editor-toolbar-group">
          <button
            className="eq-tool-btn"
            onClick={handleCursorLeft}
            title="Move cursor left"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="eq-tool-btn"
            onClick={handleCursorRight}
            title="Move cursor right"
          >
            <ChevronRight size={16} />
          </button>
          <div className="eq-tool-separator" />
          <button
            className="eq-tool-btn eq-tool-delete"
            onClick={handleBackspace}
            title="Backspace"
          >
            <Delete size={15} />
          </button>
          <button
            className="eq-tool-btn"
            onClick={handleClear}
            title="Clear all"
          >
            <Eraser size={14} />
          </button>
        </div>
        <div className="eq-editor-toolbar-group">
          <button
            className={`eq-tool-btn ${showRaw ? "eq-tool-active" : ""}`}
            onClick={() => setShowRaw(!showRaw)}
            title="Toggle raw LaTeX"
          >
            <Code2 size={14} />
          </button>
        </div>
      </div>

      {/* ─── Raw LaTeX (hidden by default) ─── */}
      <AnimatePresence>
        {showRaw && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <textarea
              ref={textareaRef}
              className="eq-editor-raw"
              value={value}
              onChange={handleTextareaChange}
              onSelect={(e) => {
                const target = e.target as HTMLTextAreaElement;
                setCursorPos(target.selectionStart);
              }}
              rows={2}
              spellCheck={false}
              placeholder="Raw LaTeX..."
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Symbol keyboard ─── */}
      <div className="eq-editor-keyboard">
        <div className="keyboard-tabs">
          {Object.keys(CATEGORIES).map((cat) => (
            <button
              key={cat}
              className={`keyboard-tab ${activeTab === cat ? "active" : ""}`}
              onClick={() => setActiveTab(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="keyboard-grid">
          {CATEGORIES[activeTab].map((key, i) => (
            <button
              key={`${activeTab}-${i}`}
              className="keyboard-btn"
              onClick={() => insertLatex(key.latex)}
              title={key.latex}
            >
              <span
                dangerouslySetInnerHTML={{
                  __html: renderKatexSafe(key.display || key.latex.trim() || key.label),
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* ─── Done button ─── */}
      <button className="eq-editor-done" onClick={onClose}>
        <Check size={16} />
        <span>Done</span>
      </button>
    </motion.div>
  );
}
