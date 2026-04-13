export interface OutputSegment {
  type: "text" | "equation";
  value: string;
}

export interface ExtractionMetadata {
  confidence: number;
  is_handwritten: boolean;
  version?: string;
}

export interface ExtractorResponse {
  output: OutputSegment[];
  metadata: ExtractionMetadata;
}

export interface AnalyzerItem {
  title: string;
  refinement: string;
  explanation: string;
}

export interface AnalyzerResponse {
  output: AnalyzerItem[];
}

export interface ExtractionRecord {
  id: string;
  image_url: string | null;
  extraction: string | null;
  confidence: number | null;
  is_handwritten: boolean | null;
  analyzer: string | null;
  created_at: string;
}

// State management for undo/redo
export interface EditorState {
  segments: OutputSegment[];
  analyzerResults: (AnalyzerItem | null)[];
}

export interface HistoryState {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
}

export type HistoryAction =
  | { type: "UPDATE_SEGMENT"; index: number; value: string }
  | { type: "APPLY_REFINEMENT"; index: number; latex: string }
  | { type: "SET_STATE"; state: EditorState }
  | { type: "UNDO" }
  | { type: "REDO" };
