"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Undo2,
  Redo2,
  Code2,
  CornerDownLeft,
  Sigma,
  Divide,
  Radical,
  Superscript,
  Subscript,
} from "lucide-react";

interface MathEditorProps {
  value: string;
  onChange: (latex: string) => void;
  onClose: () => void;
}

/**
 * MathLive wraps multi-line equations in \displaylines{...}.
 * Strip that wrapper so KaTeX gets plain content with \\ line breaks.
 */
function cleanMathLiveOutput(latex: string): string {
  let cleaned = latex.trim();
  
  // MathLive internally uses \displaylines to stack multiple lines.
  // Sometimes it outputs \displaylines{...}, sometimes \displaylines \begin{...}.
  // KaTeX does not recognize \displaylines and renders it as an error (red text).
  // We simply erase the macro (and its opening brace if present).
  const hasDisplayLines = cleaned.includes("\\displaylines");
  
  if (hasDisplayLines) {
    // Remove the word \displaylines. If it's followed by {, remove that too.
    // We intentionally don't worry about the closing } because KaTeX ignores stray {} 
    // as harmless grouping blocks.
    cleaned = cleaned.replace(/\\displaylines\s*\{?/g, "");
  }

  cleaned = cleaned.trim();

  // If there's an un-nested outer \\, KaTeX display mode will panic.
  // We wrap the entire block in \begin{gathered} (KaTeX's multiline equivalent)
  // if we modified a displaylines OR if there are stray newlines.
  if (hasDisplayLines || (!cleaned.startsWith("\\begin{") && cleaned.includes("\\\\"))) {
    cleaned = `\\begin{gathered}\n${cleaned}\n\\end{gathered}`;
  }

  // Remove any empty lines created by formatting
  return cleaned.replace(/^\s*[\r\n]/gm, "");
}

export default function MathEditor({ value, onChange, onClose }: MathEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mfRef = useRef<any>(null);
  const initialValueRef = useRef(value);
  const [showRaw, setShowRaw] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mathfield: any = null;

    (async () => {
      const mathlive = await import("mathlive");
      if (!mounted || !containerRef.current) return;

      mathfield = new mathlive.MathfieldElement();

      // ─── Smart editing features ───
      mathfield.smartMode = true;
      mathfield.smartFence = true;
      mathfield.smartSuperscript = true;
      mathfield.mathVirtualKeyboardPolicy = "auto";

      // ─── Mount into container (container is empty, no innerHTML clear needed) ───
      containerRef.current.appendChild(mathfield);
      mfRef.current = mathfield;

      // Set initial value AFTER mounting
      mathfield.value = initialValueRef.current;

      // ─── Override Enter key → insert newline (\\) ───
      // Must be after mount. Use keydown with capture to fire before MathLive.
      mathfield.addEventListener(
        "keydown",
        (e: KeyboardEvent) => {
          if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            mathfield.executeCommand(["insert", "\\\\"]);
          }

          // ─── Backspace: clean up empty lines ───
          if (e.key === "Backspace") {
            requestAnimationFrame(() => {
              if (!mathfield) return;
              const raw = cleanMathLiveOutput(mathfield.value);
              // Remove orphaned empty lines
              const cleaned = raw
                .replace(/^(\s*\\\\)+/g, "")
                .replace(/(\\\\s*)+$/g, "")
                .replace(/\\\\(\s*\\\\)+/g, "\\\\");
              if (cleaned !== raw) {
                mathfield.value = cleaned;
                setCurrentValue(cleaned);
                onChange(cleaned);
              }
            });
          }
        },
        { capture: true }
      );

      // ─── Listen for input changes ───
      mathfield.addEventListener("input", () => {
        const val = cleanMathLiveOutput(mathfield.value);
        setCurrentValue(val);
        onChange(val);
      });

      // Prevent commit (blur) on Enter — fallback
      mathfield.addEventListener("change", (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        requestAnimationFrame(() => mathfield?.focus());
      });

      setIsLoaded(true);

      // Auto-focus
      requestAnimationFrame(() => {
        if (mathfield && mounted) {
          mathfield.focus();
        }
      });
    })();

    return () => {
      mounted = false;
      // Let React handle unmount — don't call mathfield.remove()
      // which would conflict with React's reconciliation
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      mfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Toolbar actions ───
  const execCmd = useCallback((cmd: string | string[]) => {
    if (!mfRef.current) return;
    mfRef.current.executeCommand(cmd);
    mfRef.current.focus();
  }, []);

  const insertLatex = useCallback((latex: string) => {
    if (!mfRef.current) return;
    mfRef.current.executeCommand(["insert", latex]);
    mfRef.current.focus();
  }, []);

  const handleRawChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setCurrentValue(val);
      onChange(val);
      if (mfRef.current) {
        mfRef.current.value = val;
      }
    },
    [onChange]
  );

  const handleDone = useCallback(() => {
    // Read final value from mathfield, clean up \displaylines wrapper
    if (mfRef.current) {
      onChange(cleanMathLiveOutput(mfRef.current.value));
    }
    onClose();
  }, [onChange, onClose]);

  return (
    <motion.div
      className="math-editor"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ─── Toolbar ─── */}
      <div className="math-editor-toolbar">
        <div className="math-editor-toolbar-group">
          {/* Undo / Redo */}
          <button
            className="eq-tool-btn"
            onClick={() => execCmd("undo")}
            title="Undo"
          >
            <Undo2 size={14} />
          </button>
          <button
            className="eq-tool-btn"
            onClick={() => execCmd("redo")}
            title="Redo"
          >
            <Redo2 size={14} />
          </button>

          <div className="eq-tool-separator" />

          {/* Quick insert buttons */}
          <button
            className="eq-tool-btn"
            onClick={() => insertLatex("\\frac{#?}{#?}")}
            title="Fraction (a/b)"
          >
            <Divide size={14} />
          </button>
          <button
            className="eq-tool-btn"
            onClick={() => insertLatex("\\sqrt{#?}")}
            title="Square root"
          >
            <Radical size={14} />
          </button>
          <button
            className="eq-tool-btn"
            onClick={() => insertLatex("^{#?}")}
            title="Superscript"
          >
            <Superscript size={14} />
          </button>
          <button
            className="eq-tool-btn"
            onClick={() => insertLatex("_{#?}")}
            title="Subscript"
          >
            <Subscript size={14} />
          </button>
          <button
            className="eq-tool-btn"
            onClick={() => insertLatex("\\sum_{#?}^{#?}")}
            title="Summation"
          >
            <Sigma size={14} />
          </button>

          <div className="eq-tool-separator" />

          {/* New line */}
          <button
            className="eq-tool-btn eq-tool-newline"
            onClick={() => insertLatex("\\\\")}
            title="New line (Enter)"
          >
            <CornerDownLeft size={14} />
          </button>
        </div>

        {/* Raw toggle */}
        <button
          className={`eq-tool-btn ${showRaw ? "eq-tool-active" : ""}`}
          onClick={() => setShowRaw(!showRaw)}
          title="Toggle raw LaTeX"
        >
          <Code2 size={14} />
        </button>
      </div>

      {/* ─── Loading state (outside container to avoid React/MathLive DOM conflict) ─── */}
      {!isLoaded && (
        <div className="math-editor-field">
          <div className="math-editor-loading">
            <div className="orbit-ring" style={{ width: 24, height: 24 }} />
            <span>Loading editor...</span>
          </div>
        </div>
      )}

      {/* ─── MathLive WYSIWYG field (React doesn't manage children here) ─── */}
      <div ref={containerRef} className="math-editor-field" style={{ display: isLoaded ? undefined : 'none' }} />

      {/* ─── Raw LaTeX view (collapsed by default) ─── */}
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
              className="math-editor-raw"
              value={currentValue}
              onChange={handleRawChange}
              rows={3}
              spellCheck={false}
              placeholder="Raw LaTeX..."
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Tip bar ─── */}
      <div className="math-editor-tip">
        <span>Press <kbd>Enter</kbd> for new line · <kbd>Tab</kbd> to next slot · Type naturally</span>
      </div>

      {/* ─── Done / Save button ─── */}
      <button className="eq-editor-done" onClick={handleDone}>
        <Check size={16} />
        <span>Done</span>
      </button>
    </motion.div>
  );
}
