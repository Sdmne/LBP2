import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createApiClient } from "./api";

const api = createApiClient("/admin/api");
type Photo = Record<string, unknown>;

function photoError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to update this photo.";
  try {
    const parsed = JSON.parse(message);
    return typeof parsed.detail === "string" ? parsed.detail : "Unable to update this photo.";
  } catch {
    return message;
  }
}

export function photoDate(value: unknown, timeOnly = false) {
  const raw = String(value ?? "").trim().replace(" ", "T");
  if (!raw) return "—";
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`);
  if (Number.isNaN(date.valueOf())) return "—";
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  return timeOnly ? time : `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${time}`;
}

// Same crop geometry used by the member profile avatar editor.
export function photoCropGeometry(nw: number, nh: number, w: number, h: number, zoom: number, x: number, y: number) {
  const fit = Math.min(w / nw, h / nh), width = nw * fit, height = nh * fit, size = Math.min(width, height);
  const panX = Math.max(-(width * zoom - size) / 2, Math.min((width * zoom - size) / 2, x));
  const panY = Math.max(-(height * zoom - size) / 2, Math.min((height * zoom - size) / 2, y));
  const scale = fit * zoom, sourceSize = size / scale;
  return { width, height, size, x: panX, y: panY, sourceSize,
    sx: Math.max(0, Math.min(nw - sourceSize, nw / 2 - panX / scale - sourceSize / 2)),
    sy: Math.max(0, Math.min(nh - sourceSize, nh / 2 - panY / scale - sourceSize / 2)) };
}

function PhotoPreview({ source, fallback, deleted }: { source: string; fallback: string; deleted: boolean }) {
  const [failed, setFailed] = useState(0);
  useEffect(() => setFailed(0), [source, fallback]);
  const url = failed === 0 ? source : failed === 1 ? fallback : "";
  return url ? (
    <a className={deleted ? "profile-photo-image is-deleted" : "profile-photo-image"} href={url} target="_blank" rel="noopener noreferrer" aria-label="Open photo">
      <img src={url} alt="User photo" loading="lazy" onError={() => setFailed((value) => value + 1)} />
    </a>
  ) : <div className="profile-photo-unavailable">Photo unavailable</div>;
}

function PhotoCrop({ source, closeIcon, close, onSave }: { source: string; closeIcon: ReactNode; close: () => void; onSave: (file: File) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null), stage = useRef<HTMLDivElement>(null), img = useRef<HTMLImageElement>(null);
  const saving = useRef(false), drag = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(1), [pan, setPan] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ nw: 0, nh: 0, w: 288, h: 288 });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const measure = () => {
    if (img.current?.naturalWidth && stage.current) setDimensions({ nw: img.current.naturalWidth, nh: img.current.naturalHeight, w: stage.current.clientWidth, h: stage.current.clientHeight });
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const observer = new ResizeObserver(measure);
    if (stage.current) observer.observe(stage.current);
    return () => { observer.disconnect(); previous?.focus(); };
  }, []);
  const g = dimensions.nw ? photoCropGeometry(dimensions.nw, dimensions.nh, dimensions.w, dimensions.h, zoom, pan.x, pan.y) : null;
  const save = async () => {
    if (!g || saving.current || !img.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 900;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to crop this photo.");
      context.drawImage(img.current, g.sx, g.sy, g.sourceSize, g.sourceSize, 0, 0, 900, 900);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Unable to crop this photo.");
      await onSave(new File([blob], "avatar.jpg", { type: "image/jpeg" })); close();
    } catch (failure) { setError(photoError(failure)); }
    finally { saving.current = false; setBusy(false); }
  };
  return createPortal(
    <dialog className="admin-photo-crop" ref={dialog} aria-labelledby="admin-photo-crop-title" onCancel={(event) => { event.preventDefault(); if (!saving.current) close(); }} onClick={(event) => { if (event.target === event.currentTarget && !saving.current) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } }}>
      <header><h2 id="admin-photo-crop-title">Crop as avatar</h2><button type="button" aria-label="Close crop" disabled={busy} onClick={close}>{closeIcon}</button></header>
      <div className="admin-photo-crop-stage" ref={stage}
        onPointerDown={(event) => { if (busy || !g) return; drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, px: g.x, py: g.y }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { const d = drag.current; if (d?.id === event.pointerId) setPan({ x: d.px + event.clientX - d.x, y: d.py + event.clientY - d.y }); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <img ref={img} src={source} alt="Avatar crop preview" draggable={false} onLoad={measure} onError={() => { setDimensions((value) => ({ ...value, nw: 0 })); setError("Photo unavailable. Reload the photo and try again."); }} style={g ? { width: g.width, height: g.height, transform: `translate(-50%, -50%) translate(${g.x}px, ${g.y}px) scale(${zoom})` } : undefined} />
        <div className="admin-photo-crop-mask" style={{ width: g?.size ?? 288, height: g?.size ?? 288 }} />
      </div>
      <label className="admin-photo-crop-zoom">Zoom<input type="range" min="1" max="3" step="0.1" value={zoom} disabled={busy || !g} onChange={(event) => setZoom(Number(event.target.value))} /><span>{zoom.toFixed(1)}×</span></label>
      {error && <p className="error" role="alert">{error}</p>}
      <footer><button type="button" className="secondary" disabled={busy} onClick={close}>Cancel</button><button type="button" className="primary" disabled={busy || !g} onClick={() => void save()}>{busy ? "Saving…" : "Save Avatar"}</button></footer>
    </dialog>, document.body,
  );
}

export function UserPhotos({ profileId, rows, onReload, cropIcon, trashIcon, closeIcon }: { profileId: string; rows: Photo[]; onReload: () => void; cropIcon: ReactNode; trashIcon: ReactNode; closeIcon: ReactNode }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [cropId, setCropId] = useState("");
  const saving = useRef(false);
  const sourceFor = (id: string) => `/api/admin/profile-photos/${encodeURIComponent(id)}/content`;
  const pathFor = (id: string) => `/admin/users/${encodeURIComponent(profileId)}/photos/${encodeURIComponent(id)}`;
  const remove = async (id: string) => {
    if (saving.current || !window.confirm("Permanently delete this photo?")) return;
    saving.current = true; setBusy(true); setError("");
    try { await api.delete(pathFor(id)); onReload(); }
    catch (failure) { setError(photoError(failure)); }
    finally { saving.current = false; setBusy(false); }
  };
  return <section className="profile-photos">
    <p className="profile-photo-count">{rows.length} {rows.length === 1 ? "photo" : "photos"}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="profile-photo-grid">{rows.map((row) => {
      const id = String(row.id), state = String(row.status ?? "").toUpperCase();
      const status = String(row.moderation_status ?? row.moderationStatus ?? "PENDING").toUpperCase();
      const deleted = state === "DELETED";
      const primary = state === "ACTIVE" && status === "APPROVED" && (typeof row.isPrimary === "boolean" ? row.isPrimary : Number(row.position) === 0);
      const fallback = String(row.public_url ?? row.publicUrl ?? "");
      const safeFallback = /^(https?:\/\/|\/)/i.test(fallback) ? fallback : "";
      const deletedAt = row.deleted_at ?? row.deletedAt ?? row.updated_at;
      return <article className="profile-photo-card" key={id}>
        <div className="profile-photo-preview">
          <PhotoPreview source={sourceFor(id)} fallback={safeFallback} deleted={deleted} />
          {primary && <span className="profile-photo-primary">Primary</span>}
          {deleted && <span className="profile-photo-deleted">Deleted{photoDate(deletedAt, true) !== "—" && ` · ${photoDate(deletedAt, true)}`}</span>}
          {state === "REPLACED" && <span className="profile-photo-deleted">Replaced</span>}
          <div className="profile-photo-actions">
            {primary && <button type="button" title="Crop as avatar" aria-label="Crop as avatar" disabled={busy} onClick={() => setCropId(id)}>{cropIcon}</button>}
            <button type="button" className="profile-photo-delete" title="Permanently delete this photo" aria-label="Permanently delete this photo" disabled={busy} onClick={() => void remove(id)}>{trashIcon}</button>
          </div>
        </div>
        <footer className="profile-photo-meta"><span className={`profile-photo-status status-${status.toLowerCase()}`}>{status}</span><time>{photoDate(row.created_at ?? row.createdAt)}</time></footer>
      </article>;
    })}</div>
    {!rows.length && <p className="empty user-tab-empty">No photos.</p>}
    {cropId && <PhotoCrop key={cropId} source={sourceFor(cropId)} closeIcon={closeIcon} close={() => setCropId("")} onSave={async (file) => {
      const form = new FormData(); form.append("file", file);
      await api.upload(`${pathFor(cropId)}/avatar`, form); onReload();
    }} />}
  </section>;
}
