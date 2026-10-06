import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function Latex({ children, className = '' }) {
  if (!children || typeof children !== 'string') return children || null;

  // Regex to match $$...$$, $...$, \[...\], or \(...\)
  const regex = /(\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;
  const parts = children.split(regex);

  return (
    <span className={`inline-latex-container ${className}`}>
      {parts.map((part, index) => {
        if (!part) return null;

        let math = null;
        let isDisplay = false;

        if (part.startsWith('$$') && part.endsWith('$$')) {
          math = part.slice(2, -2);
          isDisplay = true;
        } else if (part.startsWith('\\[') && part.endsWith('\\]')) {
          math = part.slice(2, -2);
          isDisplay = true;
        } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
          math = part.slice(2, -2);
          isDisplay = false;
        } else if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          math = part.slice(1, -1);
          isDisplay = false;
        }

        if (math !== null) {
          try {
            const html = katex.renderToString(math.trim(), {
              throwOnError: false,
              displayMode: isDisplay,
            });
            return (
              <span
                key={index}
                className={isDisplay ? "block my-2 text-center" : "inline-block mx-0.5 align-middle"}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <span key={index} className="text-red-500 font-mono text-xs">{part}</span>;
          }
        }

        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}