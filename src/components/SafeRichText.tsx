import React from "react";
import DOMPurify from "dompurify";

// For rendering admin-authored rich-text (ReactQuill) HTML — e.g. Routine
// "Content" field — as real formatted HTML (paragraphs, bold, lists, etc.)
// instead of literal escaped tags. This is intentionally separate from
// MathText (src/components/MathText.tsx), which exists specifically for
// CSV-imported exam question/option text and must not be repurposed for
// general HTML (see the do-not-modify note on that file).
interface SafeRichTextProps {
  html: string;
  className?: string;
}

const SafeRichText: React.FC<SafeRichTextProps> = ({ html, className }) => {
  const clean = DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup",
      "ul", "ol", "li", "a", "img", "h1", "h2", "h3", "h4", "h5", "h6",
      "blockquote", "code", "pre", "span", "div",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "target", "rel", "class", "style"],
  });
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
};

export default SafeRichText;
