// Server-side Mermaid validation. Mermaid v11 ships with a `parse()` that runs
// in any JS env. We import it dynamically so this file can be required from
// either server code or tests without touching the DOM.

let _mermaidParse: ((src: string) => Promise<unknown>) | null = null;

async function getMermaidParse(): Promise<(src: string) => Promise<unknown>> {
  if (_mermaidParse) return _mermaidParse;
  const mod = await import("mermaid");
  // mermaid.parse may return a sync boolean in older builds; v11 returns a
  // promise that resolves to a parse-tree-ish object and rejects on syntax err.
  const m = mod.default ?? mod;
  // Some Mermaid builds need an explicit init before parse.
  try {
    if (typeof (m as { initialize?: (cfg: unknown) => void }).initialize === "function") {
      (m as { initialize: (cfg: unknown) => void }).initialize({
        startOnLoad: false,
        suppressErrorRendering: true,
      });
    }
  } catch {
    // initialize is best-effort; parse will still work without it on most builds.
  }
  _mermaidParse = (src: string) =>
    Promise.resolve(
      (m as { parse: (s: string) => unknown }).parse(src),
    ) as Promise<unknown>;
  return _mermaidParse;
}

export async function validateMermaid(
  src: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!src || !src.trim()) return { ok: false, error: "empty diagram" };
  try {
    const parse = await getMermaidParse();
    await parse(src);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
