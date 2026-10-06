import createDOMPurify from "dompurify";

const purifier = createDOMPurify(window);
const rasterImage = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/\s]*={0,2}$/i;
const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const styleProperties = new Set([
  "background-color", "border", "border-color", "border-style", "border-width",
  "border-collapse", "border-spacing", "color", "font-family", "font-size",
  "font-style", "font-weight", "height", "line-height", "list-style-type",
  "margin", "margin-bottom", "margin-left", "margin-right", "margin-top",
  "max-width", "padding", "padding-bottom", "padding-left", "padding-right",
  "padding-top", "text-align", "text-decoration", "vertical-align", "white-space", "width",
]);

function safeUrl(value: string, kind: "link" | "image" | "frame"): boolean {
  if (kind === "image" && rasterImage.test(value.trim())) return true;
  try {
    const url = new URL(value, document.baseURI);
    if (kind === "frame") {
      return url.protocol === "https:" && youtubeHosts.has(url.hostname) &&
        !url.username && !url.password && (!url.port || url.port === "443") &&
        /^\/embed\/[A-Za-z0-9_-]+$/.test(url.pathname);
    }
    return (kind === "image" ? ["https:", "http:", "blob:"] : ["https:", "http:", "mailto:", "tel:"]).includes(url.protocol);
  } catch {
    return false;
  }
}

purifier.addHook("uponSanitizeElement", (node) => {
  if (node.nodeName.toLowerCase() === "iframe" &&
      !safeUrl((node as Element).getAttribute("src") || "", "frame")) node.parentNode?.removeChild(node);
});
purifier.addHook("uponSanitizeAttribute", (node, data) => {
  const tag = node.nodeName.toLowerCase();
  if (data.attrName === "href") data.keepAttr = tag === "a" && safeUrl(data.attrValue, "link");
  if (data.attrName === "src") {
    data.keepAttr = (tag === "img" && safeUrl(data.attrValue, "image")) ||
      (tag === "iframe" && safeUrl(data.attrValue, "frame"));
  }
  if (data.attrName === "style") {
    const style = document.createElement("span").style;
    style.cssText = data.attrValue;
    const cleaned: string[] = [];
    for (let index = 0; index < style.length; index++) {
      const property = style.item(index);
      const value = style.getPropertyValue(property);
      if (styleProperties.has(property) && !/[\\<>@]|url\s*\(|expression\s*\(|var\s*\(|javascript/i.test(value)) {
        cleaned.push(property + ": " + value);
      }
    }
    data.attrValue = cleaned.join("; ");
    data.keepAttr = cleaned.length > 0;
  }
});

export function sanitizeRichHtml(value: string): string {
  return purifier.sanitize(value, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen"],
    FORBID_TAGS: ["svg", "math", "form", "input", "button", "textarea", "select", "object", "embed", "audio", "video", "source"],
    FORBID_ATTR: ["id", "name", "srcdoc", "srcset", "target"],
    ALLOW_DATA_ATTR: false,
  });
}
