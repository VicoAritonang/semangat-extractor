"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import imageCompression from "browser-image-compression";

import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Send,
  ImageIcon,
  Clock,
  ChevronRight,
  Trash2,
  Sparkles,
  Rocket,
  ScanEye,
  Orbit,
  Zap,
} from "lucide-react";
import type { ExtractionRecord } from "@/types";

interface HomeClientProps {
  supabaseUrl: string;
  supabaseKey: string;
  extractions: ExtractionRecord[];
}

export default function HomeClient({
  supabaseUrl,
  supabaseKey,
  extractions: initialExtractions,
}: HomeClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadStep, setUploadStep] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [extractions, setExtractions] = useState<ExtractionRecord[]>(initialExtractions);

  // We import supabase dynamically on client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseRef = useRef<any>(null);

  useEffect(() => {
    import("@supabase/supabase-js").then(({ createClient }) => {
      supabaseRef.current = createClient(supabaseUrl, supabaseKey);
    });
  }, [supabaseUrl, supabaseKey]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setUploadError(""); // Clear previous errors when selecting a new file
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }, []);

  const getExtractionTitle = useCallback((item: ExtractionRecord) => {
    // 1. Try to read title from analyzer
    if (item.analyzer) {
      try {
        const parsed = JSON.parse(item.analyzer);
        if (parsed && parsed.output && Array.isArray(parsed.output) && parsed.output.length > 0) {
          const eq = parsed.output.find((a: any) => a && a.title);
          if (eq && eq.title) return eq.title;
        }
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          const eq = parsed.find((a: any) => a && a.title);
          if (eq && eq.title) return eq.title;
        }
      } catch {
        // fallback
      }
    }

    // 2. Try to fallback to LaTeX string from extraction
    if (item.extraction) {
      try {
        const parsed = JSON.parse(item.extraction);
        if (parsed && parsed.output && Array.isArray(parsed.output)) {
          const eq = parsed.output.find((s: any) => s.type === "equation");
          if (eq && eq.value) return eq.value.substring(0, 30) + (eq.value.length > 30 ? "..." : "");
        }
        if (parsed && Array.isArray(parsed)) {
          const eq = parsed.find((s: any) => s.type === "equation");
          if (eq && eq.value) return eq.value.substring(0, 30) + (eq.value.length > 30 ? "..." : "");
        }
      } catch {
        // fallback
      }
    }

    return item.id.substring(0, 8) + "...";
  }, []);

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      if (!supabaseRef.current) return;
      const { error } = await supabaseRef.current
        .from("extraction")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setExtractions((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete extraction", err);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f && f.type.startsWith("image/")) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file || !supabaseRef.current) return;

    setIsUploading(true);
    setUploadStep(1);

    try {
      // 1. Process image: only compress if > 5MB
      let finalFile: Blob | File = file;
      if (file.size > 5 * 1024 * 1024) {
        setUploadProgress("Compressing image...");
        finalFile = await imageCompression(file, {
          maxSizeMB: 5,
          maxWidthOrHeight: 4096, // Preserve decent resolution
          useWebWorker: true,
        });
      }

      // 2. Upload to Imgur
      setUploadStep(2);
      setUploadProgress("Uploading to cloud...");
      const imgurForm = new FormData();
      imgurForm.append("file", finalFile);

      const imgurRes = await fetch("/api/upload", {
        method: "POST",
        body: imgurForm,
      });

      let imgurData: any = {};
      try {
        imgurData = await imgurRes.json();
      } catch (e) {
        // ignore JSON parse error if imgur fails catastrophically
      }

      let imageUrl = null;
      if (imgurRes.ok && imgurData.link) {
        imageUrl = imgurData.link;
      } else {
        console.warn("Imgur upload failed or skipped, proceeding without image URL. Reason:", imgurData.error);
        // We do *not* throw an error here, so the process continues directly to the backend extractor.
      }

      // 3. Create Supabase record
      setUploadStep(3);
      setUploadProgress("Creating extraction record...");
      const id = uuidv4();

      const { error: dbError } = await supabaseRef.current
        .from("extraction")
        .insert({
          id,
          image_url: imageUrl,
          extraction: null,
          confidence: null,
          is_handwritten: null,
          analyzer: null,
        });

      if (dbError) throw new Error(dbError.message);

      // 4. Call extractor — WAIT for response
      setUploadStep(4);
      setUploadProgress("Extracting equations...");
      const extractForm = new FormData();
      extractForm.append("file", finalFile);

      const extractRes = await fetch("/api/extract", {
        method: "POST",
        body: extractForm,
      });
      const extractData = await extractRes.json();

      if (!extractRes.ok || !extractData.output) {
        throw new Error(extractData.error || "Extraction failed");
      }

      // 5. Save extraction results to Supabase
      setUploadStep(5);
      setUploadProgress("Saving results...");

      const { error: updateError } = await supabaseRef.current
        .from("extraction")
        .update({
          extraction: JSON.stringify(extractData.output),
          confidence: Math.round(
            (extractData.metadata?.confidence || 0) * 100
          ),
          is_handwritten: extractData.metadata?.is_handwritten || false,
        })
        .eq("id", id);

      if (updateError) throw new Error(updateError.message);

      // 6. Trigger analyzer (fire-and-forget — backend writes to Supabase)
      fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: extractData.output,
          extraction_id: id,
        }),
      }).catch(console.error);

      // 7. Navigate to extraction page (data is already in Supabase)
      router.push(`/${id}`);
    } catch (err) {
      console.error(err);
      setUploadError(err instanceof Error ? err.message : "Unknown error");
      setIsUploading(false);
      setUploadStep(0);
    }
  }, [file, router]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const uploadSteps = [
    { label: "Process", icon: "🔍" },
    { label: "Upload", icon: "☁️" },
    { label: "Record", icon: "💾" },
    { label: "Extract", icon: "🔬" },
    { label: "Save", icon: "✅" },
  ];

  return (
    <div className="main-content">
      {/* Header */}
      <motion.div
        className="app-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, type: "spring", stiffness: 80 }}
      >
        <motion.h1
          className="app-logo"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 120 }}
        >
          ✦ Semangat
        </motion.h1>
        <motion.p
          className="app-tagline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Image to Equation Extractor
        </motion.p>

        {/* Decorative orbit ring */}
        <motion.div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 8,
            opacity: 0.3,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 0.5 }}
        >
          <Orbit size={16} style={{ color: "var(--accent-cosmic)", animation: "orbit 6s linear infinite" }} />
        </motion.div>
      </motion.div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <AnimatePresence>
          {uploadError && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              style={{
                marginBottom: 16,
                padding: "16px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{
                background: "rgba(239, 68, 68, 0.2)",
                padding: 6,
                borderRadius: "50%",
                color: "#ff6b6b",
              }}>
                <Zap size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "#ff6b6b", marginBottom: 2 }}>Upload Error</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{uploadError}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={`upload-zone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
          onClick={() => !file && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          id="upload-zone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            style={{ display: "none" }}
            id="file-input"
          />

          <AnimatePresence mode="wait">
            {preview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <img src={preview} alt="Preview" className="upload-preview" />
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <button
                    className="btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <ImageIcon size={13} /> Change
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="upload-icon-wrap">
                  <ScanEye
                    size={28}
                    style={{ color: "var(--accent-nebula)" }}
                  />
                </div>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 6,
                  }}
                >
                  Upload equation image
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}
                >
                  Tap to select or drag & drop
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Submit button */}
        <AnimatePresence>
          {file && !isUploading && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 14 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
            >
              <button
                className="btn-primary"
                onClick={handleSubmit}
                style={{ width: "100%" }}
                id="extract-button"
              >
                <Rocket size={16} />
                Extract Equations
                <Send size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload progress */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ marginTop: 14 }}
              className="glass-card"
            >
              <div style={{ padding: "20px 16px" }}>
                {/* Step indicators */}
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 6,
                  marginBottom: 16,
                }}>
                  {uploadSteps.map((step, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        opacity: uploadStep > i ? 1 : uploadStep === i + 1 ? 0.8 : 0.3,
                        transition: "opacity 0.3s",
                      }}
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        fontSize: 14,
                        background: uploadStep >= i + 1
                          ? "rgba(124, 58, 237, 0.15)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${uploadStep >= i + 1
                          ? "rgba(124, 58, 237, 0.3)"
                          : "rgba(255, 255, 255, 0.06)"}`,
                        transition: "all 0.3s",
                      }}>
                        {step.icon}
                      </div>
                      <span style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div style={{
                  width: "100%",
                  height: 3,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 2,
                  overflow: "hidden",
                  marginBottom: 12,
                }}>
                  <motion.div
                    style={{
                      height: "100%",
                      background: "linear-gradient(90deg, var(--accent-nebula), var(--accent-cosmic))",
                      borderRadius: 2,
                    }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${(uploadStep / 5) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                <p style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                  textAlign: "center",
                }}>
                  {uploadProgress}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Extractions List */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
        style={{ marginTop: 36 }}
      >
        <h2 className="section-title">
          <Sparkles size={14} style={{ color: "var(--accent-star)" }} />
          Recent Extractions
        </h2>

        {extractions.length === 0 ? (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Orbit size={44} style={{ color: "var(--accent-nebula)" }} />
            <p style={{ fontSize: 15, marginTop: 12 }}>No extractions yet</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Upload an image to begin your journey
            </p>
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {extractions.map((item, i) => (
              <motion.div
                key={item.id}
                onClick={() => router.push(`/${item.id}`)}
                className="extraction-item"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.4 }}
                style={{ cursor: "pointer", position: "relative" }}
                id={`extraction-${item.id}`}
              >
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <Clock size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span className="extraction-id" style={{ 
                    whiteSpace: "nowrap", 
                    overflow: "hidden", 
                    textOverflow: "ellipsis",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13
                  }}>
                    {getExtractionTitle(item)}
                  </span>
                  <span className="extraction-date" style={{ marginLeft: "auto", flexShrink: 0 }}>
                    {formatDate(item.created_at)}
                  </span>
                </div>
                
                <button
                  onClick={(e) => handleDelete(e, item.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    padding: 4,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "color 0.2s"
                  }}
                  title="Delete"
                  className="hover-danger"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
