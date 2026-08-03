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
      // Use textContent, not innerHTML: the stored text is plain text (with
      // literal newlines and Unicode combining marks like the vector arrow
      // U+20D7), not HTML. Running it through the HTML parser via innerHTML
      // can corrupt combining-character sequences and, more importantly, is
      // an XSS vector for any text field that reaches this component.
      // MathJax operates fine on real text nodes, and whitespace-pre-line
      // (applied via className below, plus as an inline fallback) makes the
      // literal \n characters render as actual line breaks.
      containerRef.current.textContent = text || '';

      if (isMathJaxReady && window.MathJax && window.MathJax.typesetPromise) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          window.MathJax.typesetPromise([containerRef.current]).catch((err: any) =>
            console.error('MathJax typeset failed: ', err)
          );
      }
    }
  }, [text, isMathJaxReady]);

  return (
    <Component ref={containerRef} className={className} style={{ whiteSpace: 'pre-line' }} />
  );
};

export default MathText;
