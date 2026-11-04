// Each one-off page names its copy file (src/_data/copy/<copyKey>.yml) in front matter.
// Page-head fields and SEO fields come from that file unless the template sets them itself.
const FIELDS = ["title", "seoTitle", "description", "heading", "lead", "label", "byline", "crumbs", "crumbTitle",
  "headImage", "headImageAlt", "headCaption", "headFit", "headActions", "closerTitle", "closerText", "ogImage"];

const computed = Object.fromEntries(FIELDS.map((f) => [f, (data) => {
  const own = data[f];
  if (own && !(typeof own === "string" && own.startsWith("{{"))) return own;
  const c = data.copyKey && data.copy && data.copy[data.copyKey];
  return c ? c[f] : data[f];
}]));

export default {
  eleventyComputed: {
    c: (data) => (data.copyKey && data.copy ? data.copy[data.copyKey] : undefined),
    ...computed,
  },
};
