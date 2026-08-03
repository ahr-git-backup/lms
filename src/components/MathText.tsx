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

// Escapes a plain-text segment for safe HTML embedding. This is what
// actually preserves Unicode combining characters (e.g. the vector arrow
// U+20D7 in "V⃗") — running such text through the HTML parser unescaped can
// misparse the combining sequence, which is what caused the box glyphs.
function escapeHtml(segment: string): string {
  return segment
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    result += escapeHtml(before).replace(/\n/g, '<br>');
    result += match[0];
    lastIndex = match.index + match[0].length;
  }
  result += escapeHtml(text.slice(lastIndex)).replace(/\n/g, '<br>');
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
