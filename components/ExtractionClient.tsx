"use client";

import { useEffect, useReducer, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, HandMetal, Keyboard, Orbit, Telescope, Undo2, Redo2, Trash2 } from "lucide-react";
import Link from "next/link";
import type {
  OutputSegment,
  AnalyzerItem,
  ExtractionRecord,
  EditorState,
  HistoryState,
  HistoryAction,
} from "@/types";
import SegmentItem from "@/components/SegmentItem";

interface ExtractionClientProps {
  id: string;
  record: ExtractionRecord;
  supabaseUrl: string;
  supabaseKey: string;
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "SET_STATE":
      return {
        past: [],
        present: action.state,
        future: [],
      };

    case "UPDATE_SEGMENT": {
      const newSegments = [...state.present.segments];
      newSegments[action.index] = {
        ...newSegments[action.index],
        value: action.value,
      };
      const newPresent: EditorState = {
        ...state.present,
        segments: newSegments,
      };
      return {
        past: [...state.past, state.present],
        present: newPresent,
        future: [],
      };
    }

    case "APPLY_REFINEMENT": {
      const newSegments = [...state.present.segments];
      newSegments[action.index] = {
        ...newSegments[action.index],
        value: action.latex,
      };
      const newPresent: EditorState = {
        ...state.present,
        segments: newSegments,
      };
      return {
        past: [...state.past, state.present],
        present: newPresent,
        future: [],
      };
    }

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past, state.present],
        present: next,
        future: newFuture,
      };
    }

    default:
      return state;
  }
}

export default function ExtractionClient({
  id,
  record,
  supabaseUrl,
  supabaseKey,
}: ExtractionClientProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [analyzerLoading, setAnalyzerLoading] = useState(false);
  const [analyzerJustLoaded, setAnalyzerJustLoaded] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(record.confidence);
  const [isHandwritten, setIsHandwritten] = useState<boolean | null>(record.is_handwritten);
  const [toast, setToast] = useState("");
  const [loadingDots, setLoadingDots] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseRef = useRef<any>(null);
  const router = useRouter();

  const initialState: HistoryState = {
    past: [],
    present: {
      segments: [],
      analyzerResults: [],
    },
    future: [],
  };

  const [historyState, dispatch] = useReducer(historyReducer, initialState);
  const { segments, analyzerResults } = historyState.present;

  // Initialize supabase client
  useEffect(() => {
    import("@supabase/supabase-js").then(({ createClient }) => {
      supabaseRef.current = createClient(supabaseUrl, supabaseKey);
    });
  }, [supabaseUrl, supabaseKey]);

  // Animated loading dots
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!supabaseRef.current) return;
    try {
      const { error } = await supabaseRef.current
        .from("extraction")
        .delete()
        .eq("id", id);
      if (error) throw error;
      router.push("/");
    } catch (err) {
      console.error("Failed to delete extraction", err);
      showToast("Failed to delete extraction");
    }
  }, [id, router, showToast]);

  // ─── Save segments to Supabase ───
  const saveSegments = useCallback(
    async (newSegments: OutputSegment[]) => {
      if (!supabaseRef.current) return;
      try {
        await supabaseRef.current
          .from("extraction")
          .update({ extraction: JSON.stringify(newSegments) })
          .eq("id", id);
      } catch (err) {
        console.error("Failed to save to Supabase:", err);
      }
    },
    [id]
  );

  // Poll / load extraction data
  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval>;

    async function loadData() {
      if (record.extraction) {
        try {
          const parsed: OutputSegment[] = JSON.parse(record.extraction);
          const analyzerData: AnalyzerItem[] = record.analyzer
            ? JSON.parse(record.analyzer)
            : [];

          const mapped = mapAnalyzerToSegments(parsed, analyzerData);

          dispatch({
            type: "SET_STATE",
            state: { segments: parsed, analyzerResults: mapped },
          });
          setConfidence(record.confidence);
          setIsHandwritten(record.is_handwritten);
          setIsLoading(false);

          if (!record.analyzer) {
            setAnalyzerLoading(true);
            pollForAnalyzer();
          }
        } catch {
          startPolling();
        }
        return;
      }
      startPolling();
    }

    function startPolling() {
      pollInterval = setInterval(async () => {
        if (cancelled || !supabaseRef.current) return;

        const { data: rawData } = await supabaseRef.current
          .from("extraction")
          .select("*")
          .eq("id", id)
          .single();
        const data = rawData as ExtractionRecord | null;

        if (data?.extraction && !cancelled) {
          try {
            const parsed: OutputSegment[] = JSON.parse(data.extraction);
            const analyzerData: AnalyzerItem[] = data.analyzer
              ? JSON.parse(data.analyzer)
              : [];

            const mapped = mapAnalyzerToSegments(parsed, analyzerData);

            dispatch({
              type: "SET_STATE",
              state: { segments: parsed, analyzerResults: mapped },
            });
            setConfidence(data.confidence);
            setIsHandwritten(data.is_handwritten);
            setIsLoading(false);
            clearInterval(pollInterval);

            if (!data.analyzer) {
              setAnalyzerLoading(true);
              pollForAnalyzer();
            }
          } catch {
            // Keep polling
          }
        }
      }, 2000);
    }

    function pollForAnalyzer() {
      const analyzerPoll = setInterval(async () => {
        if (cancelled || !supabaseRef.current) return;

        const { data: rawData2 } = await supabaseRef.current
          .from("extraction")
          .select("analyzer, extraction")
          .eq("id", id)
          .single();
        const data = rawData2 as { analyzer: string | null; extraction: string | null } | null;

        if (data?.analyzer && data?.extraction && !cancelled) {
          try {
            const extraction: OutputSegment[] = JSON.parse(data.extraction!);
            const analyzerData: AnalyzerItem[] = JSON.parse(data.analyzer!);
            const mapped = mapAnalyzerToSegments(extraction, analyzerData);

            dispatch({
              type: "SET_STATE",
              state: {
                segments: historyState.present.segments.length > 0
                  ? historyState.present.segments
                  : extraction,
                analyzerResults: mapped,
              },
            });
            setAnalyzerLoading(false);
            setAnalyzerJustLoaded(true);
            setTimeout(() => setAnalyzerJustLoaded(false), 3000);
            clearInterval(analyzerPoll);
          } catch {
            // Keep polling
          }
        }
      }, 5000);
    }

    loadData();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, record]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyState]);

  // ─── Handlers with Supabase persistence ───

  const handleUpdateSegment = useCallback(
    (index: number, value: string) => {
      dispatch({ type: "UPDATE_SEGMENT", index, value });
      // Compute new segments and persist
      const newSegments = [...segments];
      newSegments[index] = { ...newSegments[index], value };
      saveSegments(newSegments);
    },
    [segments, saveSegments]
  );

  const handleApplyRefinement = useCallback(
    (index: number, latex: string) => {
      dispatch({ type: "APPLY_REFINEMENT", index, latex });
      // Compute new segments and persist
      const newSegments = [...segments];
      newSegments[index] = { ...newSegments[index], value: latex };
      saveSegments(newSegments);
      showToast("Refinement applied! ✦");
    },
    [segments, saveSegments, showToast]
  );

  const handleUndo = useCallback(() => {
    if (historyState.past.length === 0) return;
    const previousSegments = historyState.past[historyState.past.length - 1].segments;
    dispatch({ type: "UNDO" });
    saveSegments(previousSegments);
  }, [historyState.past, saveSegments]);

  const handleRedo = useCallback(() => {
    if (historyState.future.length === 0) return;
    const nextSegments = historyState.future[0].segments;
    dispatch({ type: "REDO" });
    saveSegments(nextSegments);
  }, [historyState.future, saveSegments]);

  const canUndo = historyState.past.length > 0;
  const canRedo = historyState.future.length > 0;

  return (
    <div className="main-content">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <button
          onClick={handleDelete}
          className="hover-danger"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            padding: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            transition: "all 0.2s"
          }}
        >
          <Trash2 size={16} /> Delete
        </button>
      </motion.div>

      {/* Source Image */}
      {record.image_url && (
        <motion.div
          className="source-image-container glass-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
          style={{ padding: 12 }}
        >
          <img
            src={record.image_url}
            alt="Source equation"
            className="source-image"
          />
        </motion.div>
      )}

      {/* Metadata */}
      <AnimatePresence>
        {(confidence !== null || isHandwritten !== null) && !isLoading && (
          <motion.div
            className="metadata-row"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.15 }}
          >
            {confidence !== null && (
              <motion.span
                className="badge badge-confidence"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <Zap size={12} /> Confidence: {confidence}%
              </motion.span>
            )}
            {isHandwritten !== null && (
              <motion.span
                className={`badge ${isHandwritten ? "badge-handwritten" : "badge-typed"}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                {isHandwritten ? (
                  <>
                    <HandMetal size={12} /> Handwritten
                  </>
                ) : (
                  <>
                    <Keyboard size={12} /> Typed
                  </>
                )}
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state — Cosmic wormhole */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="loading-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <div style={{ position: "relative", width: 90, height: 90 }}>
              <div className="orbit-ring" style={{ width: 90, height: 90 }} />
              <div style={{
                position: "absolute",
                inset: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Telescope
                  size={24}
                  style={{
                    color: "var(--accent-cosmic)",
                    animation: "float 3s ease-in-out infinite",
                  }}
                />
              </div>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                color: "var(--text-secondary)",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Extracting equations{loadingDots}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ color: "var(--text-muted)", fontSize: 13 }}
            >
              AI is scanning your image across the galaxy
            </motion.p>

            <motion.div
              style={{
                width: 120, height: 120, borderRadius: "50%",
                border: "1px solid rgba(124, 58, 237, 0.15)",
                position: "absolute", top: "50%", left: "50%",
                marginTop: -60, marginLeft: -60,
              }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Segments */}
      <AnimatePresence>
        {!isLoading && segments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <h2 className="section-title" style={{ marginTop: 8 }}>
              Extraction Results
            </h2>

            {/* Undo/Redo bar — works on mobile & desktop */}
            <motion.div
              className="undo-redo-bar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <button
                className={`undo-redo-btn ${canUndo ? "active" : ""}`}
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={14} />
                <span>Undo</span>
                {canUndo && <span className="undo-redo-count">{historyState.past.length}</span>}
              </button>
              <button
                className={`undo-redo-btn ${canRedo ? "active" : ""}`}
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={14} />
                <span>Redo</span>
                {canRedo && <span className="undo-redo-count">{historyState.future.length}</span>}
              </button>
            </motion.div>

            <AnimatePresence>
              {segments.map((seg, i) => {
                const analyzerForThis = analyzerResults[i] || null;
                const isEq = seg.type === "equation";

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.06 * i, type: "spring", stiffness: 100, damping: 20 }}
                  >
                    <SegmentItem
                      segment={seg}
                      index={i}
                      analyzerResult={analyzerForThis}
                      analyzerLoading={isEq && analyzerLoading}
                      analyzerJustLoaded={isEq && analyzerJustLoaded}
                      onUpdate={handleUpdateSegment}
                      onApplyRefinement={handleApplyRefinement}
                      showToast={showToast}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      <AnimatePresence>
        {!isLoading && segments.length === 0 && (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Orbit size={44} style={{ color: "var(--accent-nebula)" }} />
            <p style={{ marginTop: 12 }}>No equations found in this image.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </div>
  );
}

// Map analyzer results (sequential for equations) to segment indices
function mapAnalyzerToSegments(
  segments: OutputSegment[],
  analyzerResults: AnalyzerItem[]
): (AnalyzerItem | null)[] {
  const mapped: (AnalyzerItem | null)[] = new Array(segments.length).fill(null);
  let eqIdx = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].type === "equation") {
      if (eqIdx < analyzerResults.length) {
        mapped[i] = analyzerResults[eqIdx];
        eqIdx++;
      }
    }
  }
  return mapped;
}
