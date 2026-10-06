import React, { useState, useEffect, useRef } from 'react';
import {
  Key,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clipboard,
  Trash2,
  Check,
  Grid
} from 'lucide-react';
import { parseAnswerKeyInput } from './utils';

export default function BulkAnswerKeyModal({
  isOpen,
  onClose,
  questions = [],
  examTitle = "Exam Paper",
  onApply,
  isSaving = false,
  apiBase = "http://localhost:8000",
  showToast = () => {}
}) {
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' | 'matrix'
  const [rawText, setRawText] = useState('');
  const [keyMap, setKeyMap] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [focusedMatrixIndex, setFocusedMatrixIndex] = useState(0);
  const matrixContainerRef = useRef(null);

  // Initialize keyMap whenever modal opens or questions change
  useEffect(() => {
    if (!isOpen) return;

    const initial = {};
    const textLines = [];
    questions.forEach((q, idx) => {
      const qNum = q.question_number || (idx + 1);
      if (q.correct_answer) {
        initial[qNum] = q.correct_answer;
        textLines.push(`${qNum}. ${q.correct_answer}`);
      }
    });

    setKeyMap(initial);
    setRawText(textLines.length > 0 ? textLines.join('\n') : '');
    setActiveTab('paste');
    setFocusedMatrixIndex(0);
  }, [isOpen, questions]);

  // Handle typing / pasting into textarea
  const handleTextChange = (e) => {
    const val = e.target.value;
    setRawText(val);
    const parsed = parseAnswerKeyInput(val, questions.length);
    setKeyMap(parsed);
  };

  // Quick format sample fillers
  const fillSampleFormat = (sampleType) => {
    let sample = '';
    const total = questions.length > 0 ? questions.length : 10;
    const letters = ['A', 'B', 'C', 'D'];

    if (sampleType === 'numbered_dot') {
      sample = Array.from({ length: total }, (_, i) => `${i + 1}. ${letters[i % 4]}`).join('\n');
    } else if (sampleType === 'numbered_dash') {
      sample = Array.from({ length: total }, (_, i) => `${i + 1}-${letters[i % 4]}`).join(', ');
    } else if (sampleType === 'comma_separated') {
      sample = Array.from({ length: total }, (_, i) => letters[i % 4]).join(', ');
    } else if (sampleType === 'continuous') {
      sample = Array.from({ length: total }, (_, i) => letters[i % 4]).join('');
    }

    setRawText(sample);
    const parsed = parseAnswerKeyInput(sample, questions.length);
    setKeyMap(parsed);
    showToast("Sample format populated!");
  };

  // AI Smart Extract using Gemini endpoint
  const handleAiExtract = async () => {
    if (!rawText.trim()) {
      showToast("Please enter or paste answer key text first.", "error");
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/parse-answer-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: rawText,
          total_questions: questions.length
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to extract answer keys.");

      const updated = { ...keyMap };
      Object.entries(data.answers || {}).forEach(([k, v]) => {
        updated[parseInt(k, 10)] = v;
      });
      setKeyMap(updated);
      showToast(`✨ Gemini AI extracted ${data.count} answers successfully!`);
    } catch (err) {
      showToast(err.message || "AI extraction failed.", "error");
    } finally {
      setAiLoading(false);
    }
  };

  // Matrix direct option setter
  const handleMatrixSelect = (qNum, optKey) => {
    setKeyMap((prev) => {
      const updated = { ...prev };
      if (updated[qNum] === optKey) {
        delete updated[qNum];
      } else {
        updated[qNum] = optKey;
      }
      return updated;
    });
  };

  // Keyboard navigation inside Matrix
  const handleMatrixKeyDown = (e, qIndex, qNum) => {
    const key = e.key.toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(key)) {
      e.preventDefault();
      handleMatrixSelect(qNum, key);
      // Auto-advance to next question
      if (qIndex + 1 < questions.length) {
        setFocusedMatrixIndex(qIndex + 1);
        const nextEl = document.getElementById(`matrix-q-${qIndex + 1}`);
        if (nextEl) nextEl.focus();
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (qIndex + 1 < questions.length) {
        setFocusedMatrixIndex(qIndex + 1);
        const nextEl = document.getElementById(`matrix-q-${qIndex + 1}`);
        if (nextEl) nextEl.focus();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (qIndex - 1 >= 0) {
        setFocusedMatrixIndex(qIndex - 1);
        const prevEl = document.getElementById(`matrix-q-${qIndex - 1}`);
        if (prevEl) prevEl.focus();
      }
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      setKeyMap((prev) => {
        const updated = { ...prev };
        delete updated[qNum];
        return updated;
      });
    }
  };

  // Bulk matrix helpers
  const handleClearAll = () => {
    setKeyMap({});
    setRawText('');
    showToast("Cleared all answer keys.");
  };

  const handleFillAllWith = (letter) => {
    const updated = {};
    questions.forEach((q, idx) => {
      const qNum = q.question_number || (idx + 1);
      updated[qNum] = letter;
    });
    setKeyMap(updated);
    showToast(`Set all questions to option (${letter}).`);
  };

  // Counts & stats
  const totalQuestions = questions.length;
  const markedCount = Object.keys(keyMap).filter((k) => {
    const qNum = parseInt(k, 10);
    return qNum >= 1 && qNum <= totalQuestions && ['A', 'B', 'C', 'D'].includes(keyMap[k]);
  }).length;
  const percentage = totalQuestions > 0 ? Math.round((markedCount / totalQuestions) * 100) : 0;

  // Find missing questions
  const missingQuestions = [];
  for (let i = 1; i <= totalQuestions; i++) {
    if (!keyMap[i]) {
      missingQuestions.push(i);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 border-b border-slate-800 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-900 flex items-center justify-center shadow-lg shadow-amber-500/20 font-black">
              <Key className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">Bulk Answer Key Provider</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Instant Grading Setup
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Paper: <strong className="text-white">{examTitle}</strong> • {totalQuestions} Questions Total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Completion Pill */}
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-1.5 text-right">
              <div className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Answer Key Progress</div>
              <div className="text-sm font-extrabold flex items-center gap-1.5 justify-end">
                <span className={percentage === 100 ? "text-emerald-400" : "text-amber-300"}>
                  {markedCount} / {totalQuestions}
                </span>
                <span className="text-xs text-slate-400 font-normal">({percentage}%)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className={`h-full transition-all duration-300 ${percentage === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Sub-tab Navigation */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'paste'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste Answer Key (All Formats)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Rapid Keypad Matrix</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {activeTab === 'paste' ? "Autodetects numbers, letters, & delimiters" : "Press physical A/B/C/D keys to auto-advance"}
          </span>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* ============================================================== */}
          {/* TAB 1: BULK PASTE & SMART AI EXTRACT                           */}
          {/* ============================================================== */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              {/* Format Helper Chips */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Quick format examples (click to preview):</span>
                  <span className="text-slate-400 text-[11px]">Instant live parsing as you type</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fillSampleFormat('numbered_dot')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-600 rounded-lg text-xs font-mono border border-slate-200 transition"
                  >
                    1. A, 2. B, 3. C...
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSampleFormat('numbered_dash')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-600 rounded-lg text-xs font-mono border border-slate-200 transition"
                  >
                    1-A, 2-B, 3-C...
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSampleFormat('comma_separated')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-600 rounded-lg text-xs font-mono border border-slate-200 transition"
                  >
                    A, B, C, D, A...
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSampleFormat('continuous')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-600 rounded-lg text-xs font-mono border border-slate-200 transition"
                  >
                    ABCDABCD...
                  </button>
                </div>
              </div>

              {/* Textarea Input */}
              <div className="space-y-2">
                <div className="relative">
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={handleTextChange}
                    placeholder={`Paste your entire answer key here. Supports any standard format, e.g.:
1. A
2. B
3. C
or: 1-A, 2-B, 3-C, 4-D
or: A, B, C, D, A, B
or: ABCDABCD...`}
                    className="w-full text-xs font-mono p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAiExtract}
                      disabled={aiLoading}
                      className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Use Gemini AI to extract answers from messy text or tables"
                    >
                      {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                      <span>{aiLoading ? "Extracting..." : "✨ AI Smart Extract (Gemini)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    {totalQuestions} questions expected in this examination
                  </span>
                </div>
              </div>

              {/* Parse Status Banner */}
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  markedCount === totalQuestions
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : markedCount > 0
                    ? "bg-amber-50 border-amber-300 text-amber-800"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {markedCount === totalQuestions ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">
                      {markedCount === totalQuestions
                        ? `All ${totalQuestions} question answer keys detected!`
                        : markedCount > 0
                        ? `Detected ${markedCount} of ${totalQuestions} answer keys.`
                        : "No answer keys detected yet. Paste your text above or choose a sample format."}
                    </span>
                    {missingQuestions.length > 0 && markedCount > 0 && (
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Missing answers for questions: {missingQuestions.slice(0, 10).map((n) => `Q${n}`).join(', ')}
                        {missingQuestions.length > 10 ? ` and ${missingQuestions.length - 10} more` : ''}.
                      </p>
                    )}
                  </div>
                </div>

                <span className="font-extrabold text-sm flex-shrink-0">
                  {markedCount} / {totalQuestions}
                </span>
              </div>

              {/* Live Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Live Answer Mapping Preview ({questions.length} Questions)
                  </span>
                  <span className="text-slate-500 text-[11px]">Click any option below to fine-tune</span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {questions.map((q, idx) => {
                    const qNum = q.question_number || (idx + 1);
                    const parsedAnswer = keyMap[qNum] || keyMap[idx + 1] || null;
                    const isSet = !!parsedAnswer;

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition ${
                          isSet ? "bg-emerald-50/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-[80px]">
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                            Q{qNum}
                          </span>
                          <span className="text-slate-500 truncate max-w-[200px] sm:max-w-xs text-[11px]">
                            {q.question_text || `Question ${qNum}`}
                          </span>
                        </div>

                        {/* Interactive Pill Buttons */}
                        <div className="flex items-center gap-1.5">
                          {['A', 'B', 'C', 'D'].map((letter) => {
                            const isSelected = parsedAnswer === letter;
                            return (
                              <button
                                key={letter}
                                type="button"
                                onClick={() => handleMatrixSelect(qNum, letter)}
                                className={`w-7 h-7 rounded-lg font-bold text-xs transition flex items-center justify-center ${
                                  isSelected
                                    ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                                }`}
                              >
                                {letter}
                              </button>
                            );
                          })}
                        </div>

                        <div className="w-24 text-right">
                          {parsedAnswer ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Key: {parsedAnswer}
                            </span>
                          ) : (
                            <span className="text-[11px] text-rose-500 font-semibold bg-rose-50 px-2 py-0.5 rounded-full">
                              Unset
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: RAPID KEYPAD MATRIX                                     */}
          {/* ============================================================== */}
          {activeTab === 'matrix' && (
            <div className="space-y-4" ref={matrixContainerRef}>
              {/* Matrix Control Bar */}
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-3.5 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Rapid Keypad Input</h4>
                    <p className="text-[11px] text-slate-600">
                      Press <strong>A, B, C, or D</strong> on your physical keyboard to set and automatically advance to the next question.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium mr-1 text-[11px]">Fill All:</span>
                  {['A', 'B', 'C', 'D'].map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => handleFillAllWith(letter)}
                      className="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded text-xs font-bold text-slate-700 transition"
                    >
                      {letter}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="ml-1 px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded text-xs font-semibold transition"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Grid of Questions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto p-1">
                {questions.map((q, qIndex) => {
                  const qNum = q.question_number || (qIndex + 1);
                  const selectedKey = keyMap[qNum] || keyMap[qIndex + 1];
                  const isFocused = focusedMatrixIndex === qIndex;

                  return (
                    <div
                      key={qIndex}
                      id={`matrix-q-${qIndex}`}
                      tabIndex={0}
                      onFocus={() => setFocusedMatrixIndex(qIndex)}
                      onKeyDown={(e) => handleMatrixKeyDown(e, qIndex, qNum)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer outline-none ${
                        isFocused
                          ? "bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500 shadow-sm"
                          : selectedKey
                          ? "bg-emerald-50/30 border-emerald-200 hover:border-emerald-300"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-extrabold text-xs text-slate-900">
                          Question #{qNum}
                        </span>
                        {selectedKey ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Key: {selectedKey}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Unset</span>
                        )}
                      </div>

                      {/* 4 Option Buttons */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {['A', 'B', 'C', 'D'].map((letter) => {
                          const isOptSelected = selectedKey === letter;
                          return (
                            <button
                              key={letter}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMatrixSelect(qNum, letter);
                                setFocusedMatrixIndex(qIndex);
                              }}
                              className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                                isOptSelected
                                  ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-1.5">
            <span className="font-bold text-slate-800">{markedCount} of {totalQuestions}</span>
            <span>questions have an answer key assigned.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSaving || markedCount === 0}
              onClick={() => onApply(keyMap)}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md shadow-emerald-100 text-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Apply Answer Key ({markedCount} Questions)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
