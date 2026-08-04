import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface MathTextProps {
  text: string;
  className?: string;
  as?: React.ElementType;
  inline?: boolean;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MathJax: any;
  }
}

const MATHJAX_LOAD_TIMEOUT_MS = 8000;

const MathText: React.FC<MathTextProps> = ({ text, className, as, inline }) => {
  const Component = as || (inline ? 'span' : 'div');
  const containerRef = useRef<HTMLElement>(null);
  const [isMathJaxReady, setIsMathJaxReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Poll for MathJax readiness, with a timeout fallback
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      setIsMathJaxReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        setIsMathJaxReady(true);
        clearInterval(interval);
        clearTimeout(timeout);
      }
    }, 100);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!(window.MathJax && window.MathJax.typesetPromise)) setLoadFailed(true);
    }, MATHJAX_LOAD_TIMEOUT_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      // Sanitize before injecting — strips scripts/unsafe tags while keeping LaTeX ($...$, \(...\)) intact.
      containerRef.current.innerHTML = DOMPurify.sanitize(text || '');

      if (isMathJaxReady && window.MathJax && window.MathJax.typesetPromise) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          window.MathJax.typesetPromise([containerRef.current]).catch((err: any) =>
            console.error('MathJax typeset failed: ', err)
          );
      }
    }
  }, [text, isMathJaxReady]);

  return (
    <>
      <Component ref={containerRef} className={cn('whitespace-pre-line', className)} />
      {loadFailed && (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5">
          গাণিতিক সূত্র লোড হতে সমস্যা হচ্ছে — পেজ রিফ্রেশ করুন।
        </span>
      )}
    </>
  );
};

export default MathText;
