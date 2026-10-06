/**
 * Utility functions for PrepPortal
 */

/**
 * Robust Answer Key Parser supporting all common formats:
 * 1. Numbered pairs: "1. A", "1-A", "1: A", "Q1: A", "1) A", "Question 1 = A", "1 A"
 * 2. Delimited sequence: "A, B, C, D" or "A B C D" or lines
 * 3. Continuous string: "ABCDABCD"
 * 4. Fallback isolated letters
 */
export function parseAnswerKeyInput(text, totalQuestions = 0) {
  if (!text || !text.trim()) return {};
  const cleaned = text.trim();
  const result = {};

  // Pattern 1: Numbered pairs
  const pairRegex = /(?:Q(?:uestion)?\s*|#\s*)?(\d+)[\s.:=\-–)]+([A-Da-d])\b/gi;
  let pairMatch;
  let pairCount = 0;
  while ((pairMatch = pairRegex.exec(cleaned)) !== null) {
    const qNum = parseInt(pairMatch[1], 10);
    const ans = pairMatch[2].toUpperCase();
    if (qNum > 0 && ['A', 'B', 'C', 'D'].includes(ans)) {
      result[qNum] = ans;
      pairCount++;
    }
  }

  if (pairCount >= 2 || (pairCount === 1 && totalQuestions <= 1)) {
    return result;
  }

  // Pattern 2: Continuous string e.g. "ABCDABCD"
  const noWs = cleaned.replace(/\s+/g, '');
  if (/^[A-Da-d]{2,}$/i.test(noWs)) {
    for (let i = 0; i < noWs.length; i++) {
      result[i + 1] = noWs[i].toUpperCase();
    }
    return result;
  }

  // Pattern 3: Delimited single letters: "A, B, C, D" or "A B C D" or lines
  const tokens = cleaned.split(/[\s,;|/]+/).filter(Boolean);
  const allSingleLetters = tokens.length > 0 && tokens.every(t => /^[A-Da-d]$/i.test(t));
  if (allSingleLetters) {
    tokens.forEach((t, idx) => {
      result[idx + 1] = t.toUpperCase();
    });
    return result;
  }

  // Pattern 4: Fallback - collect any isolated A, B, C, D in order
  const lettersRegex = /\b([A-Da-d])\b/g;
  let letterMatch;
  let idx = 1;
  while ((letterMatch = lettersRegex.exec(cleaned)) !== null) {
    result[idx] = letterMatch[1].toUpperCase();
    idx++;
  }

  return result;
}
