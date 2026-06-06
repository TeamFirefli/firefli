export function sanitizeJSON(node: any): any {
  const disallowedTypes = new Set(["iframe", "htmlBlock", "script", "embed", "video", "rawHTML"]);
  const SAFE_DATA_URI_PATTERN = /^data:image\/(png|jpeg|gif|svg\+xml|webp);/;

  function isSafeUrl(url: any) {
    if (typeof url !== "string") return false;
    if (/^https?:\/\//.test(url)) return true;
    if (/^mailto:/.test(url)) return true;
    if (/^data:/.test(url)) return SAFE_DATA_URI_PATTERN.test(url);
    return false;
  }

  function sanitize(node: any): any {
    if (!node || typeof node !== "object") return node;
    if (node.type && disallowedTypes.has(node.type)) return null;

    const out: any = { ...node };

    if (out.attrs && typeof out.attrs === "object") {
      const attrs: any = { ...out.attrs };
      if (attrs.src && !isSafeUrl(attrs.src)) delete attrs.src;
      if (attrs.href && !isSafeUrl(attrs.href)) delete attrs.href;
      if (attrs.width !== undefined && !/^\d+(\.\d+)?(%|px|em|rem)?$/.test(String(attrs.width))) {
        delete attrs.width;
      }
      const SAFE_ALIGNMENTS = new Set(["left", "right", "center", "justify"]);
      if (attrs.textAlign !== undefined && !SAFE_ALIGNMENTS.has(String(attrs.textAlign))) {
        delete attrs.textAlign;
      }
      out.attrs = attrs;
    }

    if (Array.isArray(out.marks)) {
      out.marks = out.marks
        .map((m: any) => {
          if (!m || typeof m !== "object") return null;
          if (m.type === "link") {
            if (!m.attrs || !isSafeUrl(m.attrs.href)) return null;
            return { ...m, attrs: { href: String(m.attrs.href) } };
          }
          return m;
        })
        .filter(Boolean);
    }

    if (Array.isArray(out.content)) {
      out.content = out.content.map(sanitize).filter(Boolean);
    }

    return out;
  }

  try {
    return sanitize(node);
  } catch (e) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
}

export default sanitizeJSON;
