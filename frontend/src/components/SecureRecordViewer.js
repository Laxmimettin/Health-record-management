import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";
import api from "../lib/api";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

// ─── Watermark canvas ────────────────────────────────────────────────────────
function buildWatermarkCanvas(width, height, viewerName, timestamp) {
  const wc  = document.createElement("canvas");
  wc.width  = width;
  wc.height = height;
  const ctx = wc.getContext("2d");

  const stripeSize = 4;
  for (let y = 0; y < height; y += stripeSize * 2) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(0, y, width, stripeSize);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, y + stripeSize, width, stripeSize);
  }

  ctx.font = "bold 14px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  const tileW = 280, tileH = 90;

  for (let x = -tileW; x < width + tileW; x += tileW) {
    for (let y = -tileH; y < height + tileH; y += tileH) {
      ctx.save();
      ctx.translate(x + tileW / 2, y + tileH / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur  = 2;
      ctx.fillStyle   = "rgba(255,255,255,0.70)";
      ctx.fillText("🔒 SecureHealthVault", 0, -12);
      ctx.fillText(`Dr. ${viewerName}`, 0, 6);
      ctx.fillStyle = "rgba(255,80,80,0.75)";
      ctx.fillText(timestamp, 0, 22);
      ctx.restore();
    }
  }
  return wc;
}

function compositeToDisplay(displayCtx, docCanvas, watermarkCanvas, width, height) {
  displayCtx.clearRect(0, 0, width, height);
  displayCtx.globalAlpha = 1.0;
  displayCtx.globalCompositeOperation = "source-over";
  displayCtx.drawImage(docCanvas, 0, 0);
  displayCtx.globalAlpha = 0.18;
  displayCtx.globalCompositeOperation = "screen";
  displayCtx.drawImage(watermarkCanvas, 0, 0);
  displayCtx.globalAlpha = 1.0;
  displayCtx.globalCompositeOperation = "source-over";
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SecureRecordViewer({ blob, mimeType, fileName, viewerName, patientId, onClose }) {
  const displayCanvasRef = useRef(null);
  const containerRef     = useRef(null);
  const alertedRef       = useRef(new Set()); // deduplicate alerts per method per session

  const [blacked, setBlacked]       = useState(false);
  const [hidden, setHidden]         = useState(false);
  const [rendered, setRendered]     = useState(false);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfDoc, setPdfDoc]         = useState(null);
  const [zoom, setZoom]             = useState(1.2);
  const [alertSent, setAlertSent]   = useState(false); // show in-viewer confirmation

  const isImage   = mimeType?.startsWith("image/");
  const isPdf     = mimeType === "application/pdf";
  const timestamp = useRef(new Date().toLocaleString()).current;

  // Notify patient of screenshot attempt
  const notifyScreenshotAttempt = useCallback(async (method) => {
    if (!patientId) return;
    if (alertedRef.current.has(method)) return; // only one alert per method per session
    alertedRef.current.add(method);

    try {
      // Log the threat to audit system
      await api.post("/audit/threat", {
        type: "SCREENSHOT_ATTEMPT",
        severity: "HIGH",
        details: {
          method,
          context: {
            recordId: fileName || "Health Record",
            patientId: patientId,
            viewerName: viewerName,
            viewerRole: 'doctor',
            action: 'record_viewing'
          },
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      });
      
      setAlertSent(true);
      setTimeout(() => setAlertSent(false), 4000);
    } catch (error) {
      console.error('Failed to log screenshot threat:', error);
      // Still show alert even if logging fails
      setAlertSent(true);
      setTimeout(() => setAlertSent(false), 4000);
    }
  }, [patientId, fileName, viewerName]);

  // ── Screen Capture API interception ────────────────────────────────────────
  useEffect(() => {
    const origGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices);

    if (origGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async (...args) => {
        setBlacked(true);
        notifyScreenshotAttempt("screenshare");
        try {
          const stream = await origGetDisplayMedia(...args);
          stream.getTracks().forEach((t) => t.stop());
          return stream;
        } catch {
          return new MediaStream();
        }
      };
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") setHidden(true);
      else setHidden(false);
    };
    const onBlur  = () => setHidden(true);
    const onFocus = () => setHidden(false);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur",  onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      if (origGetDisplayMedia) navigator.mediaDevices.getDisplayMedia = origGetDisplayMedia;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur",  onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [notifyScreenshotAttempt]);

  // ── Keyboard blocking + notification ───────────────────────────────────────
  useEffect(() => {
    const block = (e) => {
      const k = e.key?.toLowerCase();
      const isPrintScreen = e.key === "PrintScreen";
      const isScreenshotShortcut =
        (e.ctrlKey  && ["s","p","u","a"].includes(k)) ||
        (e.metaKey  && ["s","p","u","a"].includes(k)) ||
        (e.ctrlKey  && e.shiftKey && ["i","j","c","s"].includes(k)) ||
        (e.metaKey  && e.shiftKey && ["3","4","5"].includes(e.key)) ||
        e.key === "F12" || isPrintScreen;

      if (isScreenshotShortcut) {
        e.preventDefault();
        e.stopPropagation();

        if (isPrintScreen) {
          setBlacked(true);
          setTimeout(() => setBlacked(false), 2000);
          notifyScreenshotAttempt("printscreen");
        } else if (e.ctrlKey && e.key?.toLowerCase() === "p") {
          notifyScreenshotAttempt("keyboard");
        } else if (e.metaKey && ["3","4","5"].includes(e.key)) {
          setBlacked(true);
          setTimeout(() => setBlacked(false), 2000);
          notifyScreenshotAttempt("keyboard");
        }
      }
    };
    window.addEventListener("keydown", block, true);
    window.addEventListener("keyup",   block, true);
    return () => {
      window.removeEventListener("keydown", block, true);
      window.removeEventListener("keyup",   block, true);
    };
  }, [notifyScreenshotAttempt]);

  // ── Core render ─────────────────────────────────────────────────────────────
  const renderToDisplay = useCallback((docCanvas) => {
    const display = displayCanvasRef.current;
    if (!display) return;
    const ctx = display.getContext("2d");
    display.width  = docCanvas.width;
    display.height = docCanvas.height;
    const wm = buildWatermarkCanvas(docCanvas.width, docCanvas.height, viewerName, timestamp);
    compositeToDisplay(ctx, docCanvas, wm, docCanvas.width, docCanvas.height);
    setRendered(true);
  }, [viewerName, timestamp]);

  // ── Image rendering ─────────────────────────────────────────────────────────
  const renderImage = useCallback(async () => {
    if (!blob || !isImage) return;
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const maxW  = containerRef.current?.clientWidth  || 900;
      const maxH  = containerRef.current?.clientHeight || 700;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1) * zoom;
      const docCanvas  = document.createElement("canvas");
      docCanvas.width  = img.width  * scale;
      docCanvas.height = img.height * scale;
      docCanvas.getContext("2d").drawImage(img, 0, 0, docCanvas.width, docCanvas.height);
      renderToDisplay(docCanvas);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [blob, isImage, zoom, renderToDisplay]);

  // ── PDF rendering ───────────────────────────────────────────────────────────
  const renderPdfPage = useCallback(async (doc, pageNum) => {
    if (!doc) return;
    const pdfPage  = await doc.getPage(pageNum);
    const viewport = pdfPage.getViewport({ scale: 1.5 * zoom });
    const docCanvas  = document.createElement("canvas");
    docCanvas.width  = viewport.width;
    docCanvas.height = viewport.height;
    await pdfPage.render({ canvasContext: docCanvas.getContext("2d"), viewport }).promise;
    renderToDisplay(docCanvas);
  }, [zoom, renderToDisplay]);

  const loadPdf = useCallback(async () => {
    if (!blob || !isPdf) return;
    const doc = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
    setPdfDoc(doc);
    setTotalPages(doc.numPages);
    await renderPdfPage(doc, 1);
  }, [blob, isPdf, renderPdfPage]);

  useEffect(() => {
    setRendered(false);
    if (isImage) renderImage();
    if (isPdf)   loadPdf();
  }, [isImage, isPdf, renderImage, loadPdf]);

  useEffect(() => {
    if (pdfDoc) { setRendered(false); renderPdfPage(pdfDoc, page); }
  }, [page, pdfDoc, renderPdfPage]);

  const blockEvent = (e) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{ background: "#020817", WebkitUserSelect: "none", userSelect: "none" }}
        onContextMenu={blockEvent} onDragStart={blockEvent} onDrop={blockEvent}
      >
        {/* ── Black-out overlay ── */}
        <AnimatePresence>
          {(blacked || hidden) && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.08 }}
              className="absolute inset-0 z-[99999] flex flex-col items-center justify-center bg-black"
            >
              <p className="text-5xl mb-4">🔒</p>
              <p className="text-2xl font-black text-white">Content protected</p>
              <p className="mt-3 text-sm text-slate-400 text-center max-w-md px-4">
                {blacked
                  ? "Screen capture was detected. The record is hidden and the patient has been notified."
                  : "Return to this window to continue viewing the record."}
              </p>
              {blacked && (
                <button type="button" onClick={() => setBlacked(false)}
                  className="mt-6 rounded-xl btn-brand px-6 py-2.5 text-sm glow-sky">
                  Resume viewing
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Alert sent toast ── */}
        <AnimatePresence>
          {alertSent && (
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-[99998] flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/20 px-5 py-3 text-sm font-semibold text-rose-300 shadow-2xl"
            >
              <span>⚠️</span> Screenshot attempt logged and patient notified
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#0f172a] border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-sm">🔐</div>
            <div>
              <p className="text-sm font-bold text-white">{fileName || "Health Record"}</p>
              <p className="text-[10px] text-slate-400">Secure view · Screenshot protected · Patient notified on attempt</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Zoom */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                className="text-white/60 hover:text-white px-1 text-sm font-bold">−</button>
              <span className="text-xs text-white/60 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                className="text-white/60 hover:text-white px-1 text-sm font-bold">+</button>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Protected
            </div>
            <button type="button" onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition text-sm font-bold">
              ✕
            </button>
          </div>
        </div>

        {/* ── Canvas area ── */}
        <div ref={containerRef}
          className="relative flex-1 overflow-auto flex items-start justify-center p-6"
          style={{ background: "#0a0f1e" }}
          onContextMenu={blockEvent}
        >
          {!rendered && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="spinner scale-150 border-sky-400/30 border-t-sky-400" />
                <p className="mt-4 text-sm text-slate-400">Rendering securely…</p>
              </div>
            </div>
          )}
          <canvas ref={displayCanvasRef}
            onContextMenu={blockEvent} onDragStart={blockEvent}
            style={{
              display: rendered ? "block" : "none",
              borderRadius: "12px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
              WebkitUserDrag: "none",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* ── PDF pagination ── */}
        {isPdf && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-3 bg-[#0f172a] border-t border-white/10 flex-shrink-0">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded-lg btn-ghost px-4 py-1.5 text-sm disabled:opacity-30">← Prev</button>
            <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="rounded-lg btn-ghost px-4 py-1.5 text-sm disabled:opacity-30">Next →</button>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-2 bg-[#0f172a] border-t border-white/10 flex-shrink-0">
          <p className="text-[10px] text-slate-500">🔒 Encrypted · Audited · Patient notified on screenshot attempt</p>
          <p className="text-[10px] text-slate-500">
            Dr. <span className="text-slate-300 font-semibold">{viewerName}</span> · {timestamp}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
