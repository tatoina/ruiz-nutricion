import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * RepoViewer
 * Props:
 * - owner: string (github owner/org)
 * - repo: string (repo name)
 * - path: string (ruta dentro del repo; default: "")
 * - token: optional string (GitHub token, for private repos) - if not passed uses env REACT_APP_GITHUB_TOKEN
 *
 * Muestra README (si existe) y la lista de archivos en `path`.
 */
export default function RepoViewer({ owner, repo, path = "", token = null }) {
  const [loading, setLoading] = useState(true);
  const [readme, setReadme] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const authToken = token || process.env.REACT_APP_GITHUB_TOKEN || null;

  const ghHeaders = () => {
    const headers = { Accept: "application/vnd.github.v3+json" };
    if (authToken) headers.Authorization = `token ${authToken}`;
    return headers;
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setReadme(null);
    setItems([]);

    const fetchReadme = async () => {
      try {
        const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
        const res = await fetch(url, { headers: ghHeaders() });
        if (!mounted) return;
        if (res.status === 404) {
          setReadme(null);
        } else if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Error readme: ${res.status} ${txt}`);
        } else {
          const data = await res.json();
          // content is base64
          const content = atob(data.content.replace(/\n/g, ""));
          setReadme({ content, encoding: data.encoding, html_url: data.html_url });
        }
      } catch (err) {
        if (!mounted) return;
        // don't fail hard if no readme
        console.warn("RepoViewer readme error:", err);
        setReadme(null);
      }
    };

    const fetchContents = async () => {
      try {
        const p = path ? encodeURIComponent(path) : "";
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${p}`;
        const res = await fetch(url, { headers: ghHeaders() });
        if (!mounted) return;
        if (res.status === 404) {
          setItems([]);
        } else if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Error contents: ${res.status} ${txt}`);
        } else {
          const data = await res.json();
          // data can be an object (file) or array (folder)
          const list = Array.isArray(data) ? data : [data];
          const normalized = list.map((it) => ({
            name: it.name,
            path: it.path,
            type: it.type, // "file" or "dir"
            download_url: it.download_url,
            html_url: it.html_url,
            sha: it.sha,
          }));
          setItems(normalized);
        }
      } catch (err) {
        if (!mounted) return;
        console.error("RepoViewer contents error:", err);
        setError(err.message || String(err));
      }
    };

    Promise.all([fetchReadme(), fetchContents()]).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [owner, repo, path, authToken]);

  const viewFile = async (item) => {
    // if item.download_url available we can fetch raw and, if markdown, render
    if (!item || !item.download_url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(item.download_url, { headers: ghHeaders() });
      if (!res.ok) throw new Error(`No se pudo obtener el archivo (${res.status})`);
      const text = await res.text();
      // show simple modal-like overlay using window.open for simplicity OR set readme to text and treat as markdown if .md
      if (item.name.toLowerCase().endsWith(".md") || item.name.toLowerCase().endsWith(".markdown")) {
        setReadme({ content: text, encoding: "utf-8", html_url: item.html_url, filename: item.name });
      } else {
        // open in new tab the raw content (simpler UX)
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        // revoke later
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (err) {
      console.error("viewFile error:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>{owner}/{repo}</strong> {path ? <small> / {path}</small> : null}
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>
          {authToken ? <span>Acceso token</span> : <span>Acceso público</span>}
        </div>
      </div>

      {loading && <div style={{ marginTop: 12 }}>Cargando repositorio...</div>}
      {error && <div style={{ marginTop: 12, color: "var(--danger,#b91c1c)" }}>Error: {error}</div>}

      {/* README render */}
      {readme && (
        <div style={{ marginTop: 12 }}>
          <h4>README</h4>
          <div style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid #f3f3f3" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme.content}</ReactMarkdown>
            <div style={{ marginTop: 8 }}>
              <a href={readme.html_url} target="_blank" rel="noreferrer">Ver en GitHub</a>
            </div>
          </div>
        </div>
      )}

      {/* file list */}
      <div style={{ marginTop: 12 }}>
        <h4>Archivos</h4>
        {items.length === 0 ? (
          <div className="mensaje">No se encontraron archivos en esta ruta.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((it) => (
              <li key={it.sha || it.path} style={{ padding: "6px 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f5f5f5" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 10, textAlign: "center" }}>{it.type === "dir" ? "📁" : "📄"}</div>
                  <div style={{ fontSize: 14 }}>{it.name}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {it.type === "file" && it.download_url && <button className="btn ghost" onClick={() => viewFile(it)}>Ver</button>}
                  <a className="btn ghost" href={it.html_url} target="_blank" rel="noreferrer">GitHub</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}