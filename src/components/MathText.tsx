import React, { useEffect, useRef, useState } from 'react';

interface MathTextProps {
  text: string;
  className?: string;
  as?: React.ElementType;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MathJax: any;
  }
}

// Escapes a plain-text segment for safe HTML embedding.
function escapeHtml(segment: string): string {
  return segment
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// U+20D7 (combining right arrow above) relies on the browser/OS text-shaping
// engine to draw it stacked over the preceding character. On several mobile
// browsers this fails outright (renders as a missing-glyph box) even when
// the font file has the glyph, because the shaping step itself doesn't
// support this rarely-used combining mark. Instead of depending on native
// combining-mark rendering, this renders the arrow as a manually positioned
// span sitting above the character that precedes it — works identically
// everywhere since it's just two stacked, independently-drawn glyphs.
const VECTOR_ARROW_REGEX = /([^<>\s])\s?\u20D7/g;
function replaceVectorArrows(html: string): string {
  // Uses a standard right-arrow (U+2192, universally supported by every
  // font) sized down and positioned above the preceding character, rather
  // than trying to render U+20D7 itself — some fonts only define U+20D7 as
  // an actual combining glyph and fail to draw it standalone too.
  // Note: stored text sometimes has a space between the base character and
  // the arrow (e.g. "V ⃗" rather than "V⃗") — the optional \s? consumes and
  // discards that space so the arrow still renders directly above the V.
  return html.replace(
    VECTOR_ARROW_REGEX,
    '<span style="position:relative;display:inline-block;padding-top:0.55em;">$1<span style="position:absolute;top:-0.05em;left:50%;transform:translateX(-50%) scaleX(1.3);font-size:0.6em;line-height:1;">&#8594;</span></span>'
  );
}

// Some stored questions embed a literal <img class="qimg" src="..."> tag to
// show a diagram inline. Everything else in the text is plain text that must
// be escaped, not parsed as HTML. This splits on <img ...> tags, escapes the
// text segments in between, converts literal newlines to <br> so multi-line
// "i./ii./iii." style questions render as separate lines, and re-assembles
// safe HTML with the original <img> tags intact.
function toSafeHtml(text: string): string {
  const imgTagPattern = /<img\b[^>]*>/gi;
  let lastIndex = 0;
  let result = '';
  let match: RegExpExecArray | null;
  while ((match = imgTagPattern.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    result += replaceVectorArrows(escapeHtml(before).replace(/\n/g, '<br>'));
    result += match[0];
    lastIndex = match.index + match[0].length;
  }
  result += replaceVectorArrows(escapeHtml(text.slice(lastIndex)).replace(/\n/g, '<br>'));
  return result;
}

const MathText: React.FC<MathTextProps> = ({ text, className, as: Component = 'div' }) => {
  const containerRef = useRef<HTMLElement>(null);
  const [isMathJaxReady, setIsMathJaxReady] = useState(false);

  // Poll for MathJax readiness
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
        setIsMathJaxReady(true);
    } else {
        const interval = setInterval(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                setIsMathJaxReady(true);
                clearInterval(interval);
            }
        }, 100);
        return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = toSafeHtml(text || '');

      if (isMathJaxReady && window.MathJax && window.MathJax.typesetPromise) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          window.MathJax.typesetPromise([containerRef.current]).catch((err: any) =>
            console.error('MathJax typeset failed: ', err)
          );
      }
    }
  }, [text, isMathJaxReady]);

  return (
    <Component ref={containerRef} className={className} />
  );
};

export default MathText;
