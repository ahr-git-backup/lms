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
      // Direct assignment to remove any restrictions
      containerRef.current.innerHTML = text || '';

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
