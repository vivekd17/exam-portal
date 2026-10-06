import React, { useState, useEffect, useRef } from 'react';
import Latex from './Latex';
import {
  GraduationCap,
  ShieldCheck,
  UploadCloud,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  Share2,
  BarChart3,
  Users,
  Download,
  Award,
  RefreshCw,
  LogOut,
  Plus,
  Trash2,
  Edit3,
  ArrowLeft,
  FileText,
  Key,
  User,
  Sparkles,
  ExternalLink,
  HelpCircle,
  CheckCheck,
  Zap
} from 'lucide-react';
import BulkAnswerKeyModal from './BulkAnswerKeyModal';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function App() {
  // Navigation & High-level State
  const [portalMode, setPortalMode] = useState('student'); // 'student' | 'admin'
  const [adminTab, setAdminTab] = useState('upload'); // 'upload' | 'dashboard'
  const [toast, setToast] = useState(null);

  // Helper for Toast Notifications
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ----------------- STUDENT FLOW STATE -----------------
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [studentNameInput, setStudentNameInput] = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState(null);

  // Active Exam State (Student)
  const [activeExam, setActiveExam] = useState(null); // exam paper data from server
  const [examStarted, setExamStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [questionStatus, setQuestionStatus] = useState({}); // 'visited', 'answered', 'review', 'answered_review'
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examResult, setExamResult] = useState(null); // result from /api/exams/{id}/submit

  // ----------------- ADMIN FLOW STATE -----------------
  // Upload & Editor
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [editableExam, setEditableExam] = useState(null);
  const [adminName, setAdminName] = useState(() => localStorage.getItem('prepportal_admin_name') || '');
  const [adminPasscode, setAdminPasscode] = useState(() => localStorage.getItem('prepportal_admin_pass') || '');
  const [saveLoading, setSaveLoading] = useState(false);
  const [publishedExam, setPublishedExam] = useState(null);

  // Manual Question Creator State
  const [newQuestionDraft, setNewQuestionDraft] = useState({
    question_text: '',
    marks: 2,
    options: [
      { key: 'A', text: '' },
      { key: 'B', text: '' },
      { key: 'C', text: '' },
      { key: 'D', text: '' },
    ],
    correct_answer: 'A'
  });

  // Admin Dashboard
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [adminExamsList, setAdminExamsList] = useState([]);
  const [selectedExamDetails, setSelectedExamDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Bulk Answer Key Suite State
  const [showAnswerKeyModal, setShowAnswerKeyModal] = useState(false);
  const [answerKeyContext, setAnswerKeyContext] = useState('editable'); // 'editable' | 'dashboard'
  const [editingDashboardExam, setEditingDashboardExam] = useState(null);
  const [savingKeyLoading, setSavingKeyLoading] = useState(false);

  const handleOpenEditableAnswerKey = () => {
    if (!editableExam || !editableExam.questions || editableExam.questions.length === 0) {
      showToast("No questions available in this exam yet.", "error");
      return;
    }
    setAnswerKeyContext('editable');
    setEditingDashboardExam(null);
    setShowAnswerKeyModal(true);
  };

  const handleOpenDashboardAnswerKey = async (exam) => {
    if (!adminName.trim() || !adminPasscode.trim()) {
      showToast("Please enter your admin credentials.", "error");
      return;
    }
    setDetailsLoading(true);
    try {
      const url = `${API_BASE}/api/admin/exams/${exam.id}?admin_name=${encodeURIComponent(adminName.trim())}&admin_passcode=${encodeURIComponent(adminPasscode.trim())}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load exam details.");
      setAnswerKeyContext('dashboard');
      setEditingDashboardExam(data.exam);
      setShowAnswerKeyModal(true);
    } catch (err) {
      showToast(err.message || "Failed to load exam details.", "error");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApplyModalAnswerKeys = async (keyMap) => {
    const keysCount = Object.keys(keyMap).length;
    if (keysCount === 0) {
      showToast("No answer keys provided.", "error");
      return;
    }

    if (answerKeyContext === 'editable') {
      if (!editableExam) return;
      const updatedQuestions = (editableExam.questions || []).map((q, idx) => {
        const qNum = q.question_number || (idx + 1);
        const newAns = keyMap[qNum] || keyMap[idx + 1];
        return {
          ...q,
          correct_answer: newAns !== undefined ? newAns : q.correct_answer
        };
      });

      setEditableExam({
        ...editableExam,
        questions: updatedQuestions
      });
      showToast(`✓ Answer keys applied to paper! (${keysCount} questions marked)`);
      setShowAnswerKeyModal(false);
    } else if (answerKeyContext === 'dashboard' && editingDashboardExam) {
      setSavingKeyLoading(true);
      try {
        const updatedQuestions = (editingDashboardExam.questions || []).map((q, idx) => {
          const qNum = q.question_number || (idx + 1);
          const newAns = keyMap[qNum] || keyMap[idx + 1];
          return {
            ...q,
            correct_answer: newAns !== undefined ? newAns : q.correct_answer
          };
        });

        const totalMarks = updatedQuestions.reduce((sum, q) => sum + (parseFloat(q.marks) || 0), 0);

        const res = await fetch(`${API_BASE}/api/exams/${editingDashboardExam.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admin_name: adminName.trim(),
            admin_passcode: adminPasscode.trim(),
            title: editingDashboardExam.title,
            time_limit_minutes: editingDashboardExam.time_limit_minutes,
            total_marks: totalMarks || editingDashboardExam.total_marks,
            questions: updatedQuestions
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to update exam.");

        showToast("✓ Exam answer keys updated and saved!");
        setShowAnswerKeyModal(false);
        fetchAdminExams();
      } catch (err) {
        showToast(err.message || "Failed to save answer keys.", "error");
      } finally {
        setSavingKeyLoading(false);
      }
    }
  };

  // Read URL parameters on load for shareable exam links (?code=EXAM-XXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code') || window.location.hash.replace('#', '');
    if (codeParam) {
      setAccessCodeInput(codeParam.trim().toUpperCase());
      setPortalMode('student');
    }

    // Auto-login admin if credentials already stored
    const savedName = localStorage.getItem('prepportal_admin_name');
    const savedPass = localStorage.getItem('prepportal_admin_pass');
    if (savedName && savedPass) {
      setAdminName(savedName);
      setAdminPasscode(savedPass);
    }
  }, []);

  // Timer Effect during active exam
  useEffect(() => {
    if (!examStarted || !activeExam || examResult || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, activeExam, examResult, timeLeft]);

  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text, message = "Copied to clipboard!") => {
    navigator.clipboard.writeText(text);
    showToast(message);
  };

  // ----------------- STUDENT ACTIONS -----------------

  const handleFetchExamByCode = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = accessCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setStudentError("Please enter an exam access code.");
      return;
    }
    if (!studentNameInput.trim()) {
      setStudentError("Please enter your full name to proceed.");
      return;
    }

    setStudentLoading(true);
    setStudentError(null);

    try {
      const res = await fetch(`${API_BASE}/api/exams/access/${encodeURIComponent(cleanCode)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Exam not found. Please check your access code.");
      }

      setActiveExam(data.exam);
      const totalSec = (data.exam.time_limit_minutes || 60) * 60;
      setTimeLeft(totalSec);
      setTotalDurationSeconds(totalSec);
      setCurrentIndex(0);
      setUserAnswers({});
      setQuestionStatus({ 0: 'visited' });
      setExamStarted(false);
      setExamResult(null);
    } catch (err) {
      setStudentError(err.message || "Failed to load examination.");
    } finally {
      setStudentLoading(false);
    }
  };

  const startExamNow = () => {
    setExamStarted(true);
  };

  const selectOption = (optKey) => {
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: optKey }));
  };

  const handleSaveAndNext = () => {
    const isAnswered = !!userAnswers[currentIndex];
    setQuestionStatus((prev) => ({
      ...prev,
      [currentIndex]: isAnswered ? 'answered' : 'visited'
    }));
    navigateQuestion(currentIndex + 1);
  };

  const handleMarkForReview = () => {
    const isAnswered = !!userAnswers[currentIndex];
    setQuestionStatus((prev) => ({
      ...prev,
      [currentIndex]: isAnswered ? 'answered_review' : 'review'
    }));
    navigateQuestion(currentIndex + 1);
  };

  const clearCurrentResponse = () => {
    const updated = { ...userAnswers };
    delete updated[currentIndex];
    setUserAnswers(updated);
    setQuestionStatus((prev) => ({ ...prev, [currentIndex]: 'visited' }));
  };

  const navigateQuestion = (index) => {
    if (index >= 0 && index < activeExam.questions.length) {
      setCurrentIndex(index);
      if (!questionStatus[index]) {
        setQuestionStatus((prev) => ({ ...prev, [index]: 'visited' }));
      }
    }
  };

  const triggerAutoSubmit = () => {
    submitExamToBackend(true);
  };

  const submitExamToBackend = async (isAuto = false) => {
    if (!activeExam) return;
    setIsSubmitting(true);
    setShowSubmitConfirm(false);

    const timeTaken = Math.max(1, totalDurationSeconds - timeLeft);

    try {
      const res = await fetch(`${API_BASE}/api/exams/${activeExam.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentNameInput.trim(),
          student_id: studentIdInput.trim() || undefined,
          answers: userAnswers,
          time_taken_seconds: timeTaken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Submission failed. Please contact your administrator.");
      }

      setExamResult(data.result);
      showToast(isAuto ? "Time expired! Test submitted automatically." : "Exam submitted successfully!");
    } catch (err) {
      alert("Error submitting exam: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetStudentPortal = () => {
    setActiveExam(null);
    setExamStarted(false);
    setExamResult(null);
    setUserAnswers({});
    setQuestionStatus({});
    setStudentError(null);
  };

  // ----------------- ADMIN ACTIONS -----------------

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadLoading(true);
    setUploadError(null);
    setPublishedExam(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/extract-exam`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to process question paper with AI.");
      }

      // Populate into editable form
      setEditableExam({
        title: data.title || "Standard Examination",
        time_limit_minutes: data.time_limit_minutes || 60,
        total_marks: data.total_marks || (data.questions.length * 2),
        questions: data.questions || []
      });
      showToast("Question paper parsed and ready for review!");
    } catch (err) {
      setUploadError(err.message || "Failed to parse PDF.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleStartManualExam = () => {
    setEditableExam({
      title: "New Custom Examination",
      time_limit_minutes: 60,
      total_marks: 0,
      questions: []
    });
    setPublishedExam(null);
    setUploadError(null);
    showToast("Ready to add questions and options manually!");
  };

  const handleAddDraftQuestion = (e) => {
    if (e) e.preventDefault();
    if (!newQuestionDraft.question_text.trim()) {
      showToast("Please enter a question description.", "error");
      return;
    }
    const filledOptions = newQuestionDraft.options.filter(o => o.text.trim());
    if (filledOptions.length < 2) {
      showToast("Please fill at least 2 options (A and B).", "error");
      return;
    }

    const qNumber = (editableExam?.questions?.length || 0) + 1;
    const newQ = {
      question_number: qNumber,
      question_text: newQuestionDraft.question_text.trim(),
      marks: parseFloat(newQuestionDraft.marks) || 2,
      options: newQuestionDraft.options.map(o => ({ key: o.key, text: o.text.trim() })),
      correct_answer: newQuestionDraft.correct_answer || 'A'
    };

    setEditableExam((prev) => {
      const updated = [...(prev?.questions || []), newQ];
      const newTotal = updated.reduce((sum, q) => sum + (parseFloat(q.marks) || 0), 0);
      return {
        ...prev,
        questions: updated,
        total_marks: newTotal
      };
    });

    setNewQuestionDraft({
      question_text: '',
      marks: 2,
      options: [
        { key: 'A', text: '' },
        { key: 'B', text: '' },
        { key: 'C', text: '' },
        { key: 'D', text: '' },
      ],
      correct_answer: 'A'
    });

    showToast(`Question #${qNumber} added successfully!`);
  };

  const handlePublishExam = async () => {
    if (!adminName.trim()) {
      showToast("Please enter Admin Name.", "error");
      return;
    }
    if (!adminPasscode.trim()) {
      showToast("Please enter Admin Passcode.", "error");
      return;
    }
    if (!editableExam || editableExam.questions.length === 0) {
      showToast("Exam has no questions to save.", "error");
      return;
    }

    setSaveLoading(true);
    try {
      // Calculate total marks from question list
      const totalMarks = editableExam.questions.reduce((sum, q) => sum + (parseFloat(q.marks) || 0), 0);

      const payload = {
        admin_name: adminName.trim(),
        admin_passcode: adminPasscode.trim(),
        title: editableExam.title.trim(),
        time_limit_minutes: parseInt(editableExam.time_limit_minutes) || 60,
        total_marks: totalMarks || editableExam.total_marks || 100,
        questions: editableExam.questions
      };

      const res = await fetch(`${API_BASE}/api/exams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to save exam.");
      }

      // Persist credentials in localStorage for easy access
      localStorage.setItem('prepportal_admin_name', adminName.trim());
      localStorage.setItem('prepportal_admin_pass', adminPasscode.trim());

      setPublishedExam(data.exam);
      setEditableExam(null);
      showToast("Exam published successfully!");
    } catch (err) {
      showToast(err.message || "Failed to publish exam.", "error");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    if (e) e.preventDefault();
    if (!adminName.trim() || !adminPasscode.trim()) {
      setDashboardError("Please enter your Admin Name and Passcode.");
      return;
    }

    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_name: adminName.trim(),
          admin_passcode: adminPasscode.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid credentials.");
      }

      localStorage.setItem('prepportal_admin_name', adminName.trim());
      localStorage.setItem('prepportal_admin_pass', adminPasscode.trim());

      setAdminLoggedIn(true);
      setAdminExamsList(data.exams || []);
    } catch (err) {
      setDashboardError(err.message || "Login failed.");
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchAdminExams = async () => {
    if (!adminName || !adminPasscode) return;
    setDashboardLoading(true);
    try {
      const url = `${API_BASE}/api/admin/exams?admin_name=${encodeURIComponent(adminName)}&admin_passcode=${encodeURIComponent(adminPasscode)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setAdminExamsList(data.exams || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const viewExamDetails = async (examId) => {
    setDetailsLoading(true);
    try {
      const url = `${API_BASE}/api/admin/exams/${examId}?admin_name=${encodeURIComponent(adminName)}&admin_passcode=${encodeURIComponent(adminPasscode)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load exam details.");
      setSelectedExamDetails(data.exam);
    } catch (err) {
      showToast(err.message || "Error loading details.", "error");
    } finally {
      setDetailsLoading(false);
    }
  };

  const downloadExamCsv = (examId, title) => {
    const url = `${API_BASE}/api/admin/exams/${examId}/export-csv?admin_name=${encodeURIComponent(adminName)}&admin_passcode=${encodeURIComponent(adminPasscode)}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${title.replace(/\s+/g, '_')}_summary_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloading summary CSV report...");
  };

  const handleAdminLogout = () => {
    setAdminLoggedIn(false);
    setSelectedExamDetails(null);
    localStorage.removeItem('prepportal_admin_pass');
    setAdminPasscode('');
  };

  // Helper for question palette classes
  const getPaletteStyle = (idx) => {
    const st = questionStatus[idx];
    const isCurrent = idx === currentIndex;
    let base = "font-medium text-xs flex items-center justify-center h-9 w-9 rounded-lg border transition-all duration-150 relative cursor-pointer ";

    if (isCurrent) {
      base += "ring-2 ring-indigo-600 ring-offset-1 font-bold scale-105 shadow-sm ";
    }

    switch (st) {
      case 'answered':
        return base + "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700";
      case 'review':
        return base + "bg-purple-600 text-white border-purple-700 hover:bg-purple-700";
      case 'answered_review':
        return base + "bg-purple-600 text-white border-purple-700 hover:bg-purple-700 after:content-[''] after:w-2.5 after:h-2.5 after:bg-emerald-400 after:border after:border-white after:rounded-full after:absolute after:-top-1 after:-right-1";
      case 'visited':
        return base + "bg-rose-500 text-white border-rose-600 hover:bg-rose-600";
      default:
        return base + "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200";
    }
  };

  // =========================================================================
  // RENDER SECTIONS
  // =========================================================================

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-sm font-medium animate-bounce">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Application Header (Hidden during active test for distraction-free view) */}
      {(!examStarted || examResult) && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/95">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg tracking-tight text-slate-900">PrepPortal</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    CBT Engine 2.0
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">AI Question Digitizer & Assessment Platform</p>
              </div>
            </div>

            {/* Portal Switcher Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-sm font-semibold">
              <button
                onClick={() => setPortalMode('student')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  portalMode === 'student'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Student Portal</span>
              </button>
              <button
                onClick={() => setPortalMode('admin')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  portalMode === 'admin'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin & Examiner</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* =====================================================================
          MAIN PORTAL ROUTING
          ===================================================================== */}
      <main className="flex-1 flex flex-col">
        {portalMode === 'student' ? (
          /* =================================================================
             STUDENT PORTAL
             ================================================================= */
          <div className="flex-1 flex flex-col">
            {/* View 1: Scorecard Result View */}
            {examResult ? (
              <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 my-auto">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                  {/* Result Header Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
                      <CheckCircle2 className="w-4 h-4" /> Test Completed & Graded
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">{activeExam?.title || "Examination"}</h2>
                    <p className="text-slate-300 text-sm">
                      Candidate: <span className="font-semibold text-white">{examResult.student_name}</span>
                      {studentIdInput && <span className="ml-2">({studentIdInput})</span>}
                    </p>

                    {/* Big Score Card */}
                    <div className="mt-6 flex flex-wrap justify-center items-center gap-6">
                      <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/10 text-center min-w-[140px]">
                        <span className="text-xs uppercase font-medium text-slate-300 tracking-wider">Score Obtained</span>
                        <div className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">
                          {examResult.score} <span className="text-lg font-normal text-slate-300">/ {examResult.total_marks}</span>
                        </div>
                      </div>

                      <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/10 text-center min-w-[140px]">
                        <span className="text-xs uppercase font-medium text-slate-300 tracking-wider">Percentage</span>
                        <div className="text-3xl sm:text-4xl font-black text-indigo-300 mt-1">
                          {examResult.percentage}%
                        </div>
                      </div>

                      <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/10 text-center min-w-[140px]">
                        <span className="text-xs uppercase font-medium text-slate-300 tracking-wider">Time Taken</span>
                        <div className="text-2xl sm:text-3xl font-bold text-amber-300 mt-1">
                          {Math.floor(examResult.time_taken_seconds / 60)}m {examResult.time_taken_seconds % 60}s
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Question-by-Question Solution Breakdown */}
                  <div className="p-6 sm:p-8">
                    <div className="flex items-center justify-between border-b pb-4 mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Detailed Answer Review</h3>
                        <p className="text-xs text-slate-500">Compare your choices against the verified answer key</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.print()}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Print / Save
                        </button>
                        <button
                          onClick={resetStudentPortal}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Take Another Test
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {examResult.detailed_results?.map((item, idx) => (
                        <div
                          key={idx}
                          className={`rounded-xl border p-4 sm:p-5 transition ${
                            item.is_correct
                              ? "bg-emerald-50/40 border-emerald-200"
                              : item.student_choice
                              ? "bg-rose-50/40 border-rose-200"
                              : "bg-amber-50/40 border-amber-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-800">Q{item.question_number || idx + 1}</span>
                              {item.is_correct ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <Check className="w-3.5 h-3.5" /> Correct (+{item.marks_awarded} Marks)
                                </span>
                              ) : item.student_choice ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                  <AlertCircle className="w-3.5 h-3.5" /> Incorrect (0 / {item.marks_possible})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                  <HelpCircle className="w-3.5 h-3.5" /> Unattempted (0 / {item.marks_possible})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Question Text */}
                          <div className="text-slate-800 text-sm leading-relaxed mb-4">
                            <Latex>{item.question_text}</Latex>
                          </div>

                          {/* Options grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {item.options?.map((opt) => {
                              const isStudentSelected = item.student_choice === opt.key;
                              const isCorrectAnswer = item.correct_answer === opt.key;

                              let optClass = "p-2.5 rounded-lg border flex items-start gap-2 ";
                              if (isCorrectAnswer) {
                                optClass += "bg-emerald-100/70 border-emerald-400 text-emerald-950 font-medium";
                              } else if (isStudentSelected && !isCorrectAnswer) {
                                optClass += "bg-rose-100/70 border-rose-400 text-rose-950 font-medium";
                              } else {
                                optClass += "bg-white border-slate-200 text-slate-600";
                              }

                              return (
                                <div key={opt.key} className={optClass}>
                                  <span className="font-bold flex-shrink-0">({opt.key})</span>
                                  <div className="flex-1">
                                    <Latex>{opt.text}</Latex>
                                  </div>
                                  {isCorrectAnswer && (
                                    <span className="text-[10px] font-bold uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                                      Key
                                    </span>
                                  )}
                                  {isStudentSelected && !isCorrectAnswer && (
                                    <span className="text-[10px] font-bold uppercase bg-rose-600 text-white px-1.5 py-0.5 rounded">
                                      You
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : !activeExam ? (
              /* View 2: Enter Exam Access Code View */
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                      <GraduationCap className="w-7 h-7" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Student Exam Access</h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">
                      Enter the Exam Access Code provided by your instructor or examiner to launch your test
                    </p>
                  </div>

                  <form onSubmit={handleFetchExamByCode} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Exam Access Code *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={accessCodeInput}
                          onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                          placeholder="e.g. EXAM-EL9566"
                          className="w-full font-mono font-bold tracking-wider uppercase text-base px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition"
                        />
                        <Key className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[11px] text-slate-400">Format: EXAM-XXXX</span>
                        <button
                          type="button"
                          onClick={() => setAccessCodeInput('EXAM-EL9566')}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          Use Demo Code
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Your Full Name *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={studentNameInput}
                          onChange={(e) => setStudentNameInput(e.target.value)}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full text-sm px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition"
                        />
                        <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Student ID / Roll No (Optional)
                      </label>
                      <input
                        type="text"
                        value={studentIdInput}
                        onChange={(e) => setStudentIdInput(e.target.value)}
                        placeholder="e.g. CS2026-44"
                        className="w-full text-sm px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition"
                      />
                    </div>

                    {studentError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{studentError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={studentLoading}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {studentLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Exam Code...
                        </>
                      ) : (
                        <>
                          <span>Verify & Fetch Examination</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : !examStarted ? (
              /* View 3: Pre-Exam Briefing & Instructions */
              <div className="max-w-2xl mx-auto w-full p-4 sm:p-6 my-auto">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
                  <div className="flex items-center gap-3 border-b pb-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900">{activeExam.title}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {activeExam.access_code}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">• Standard CBT Simulator</span>
                      </div>
                    </div>
                  </div>

                  {/* Candidate Verification */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium">Candidate Name:</span>
                      <p className="text-slate-900 font-bold text-sm mt-0.5">{studentNameInput}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Student ID / Roll No:</span>
                      <p className="text-slate-900 font-bold text-sm mt-0.5">{studentIdInput || "Not Specified"}</p>
                    </div>
                  </div>

                  {/* Exam Specs Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-6 text-center">
                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="text-xl font-black text-indigo-700">{activeExam.questions.length}</div>
                      <div className="text-[11px] font-semibold text-indigo-900 uppercase mt-0.5">Questions</div>
                    </div>
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                      <div className="text-xl font-black text-amber-700">{activeExam.time_limit_minutes} Min</div>
                      <div className="text-[11px] font-semibold text-amber-900 uppercase mt-0.5">Duration</div>
                    </div>
                    <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                      <div className="text-xl font-black text-emerald-700">{activeExam.total_marks}</div>
                      <div className="text-[11px] font-semibold text-emerald-900 uppercase mt-0.5">Total Marks</div>
                    </div>
                  </div>

                  {/* Rules & Guidelines */}
                  <div className="border border-slate-200 rounded-xl p-4 mb-6 bg-slate-50/50 text-xs text-slate-700 space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Exam Instructions:</h4>
                    <ul className="list-disc pl-4 space-y-1 leading-relaxed text-slate-600">
                      <li>The countdown timer starts as soon as you click "I am Ready to Begin".</li>
                      <li>Math equations and scientific notations are rendered cleanly via LaTeX.</li>
                      <li>Use the palette on the right to track visited, answered, and review questions.</li>
                      <li>You can change your responses at any point before submitting.</li>
                      <li>The exam will auto-submit when the timer reaches 00:00.</li>
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={resetStudentPortal}
                      className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel & Go Back
                    </button>
                    <button
                      onClick={startExamNow}
                      className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition"
                    >
                      <span>I am Ready to Begin</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* View 4: Full Active CBT Examination Screen */
              <div className="flex-1 flex flex-col bg-slate-100 select-none">
                {/* Examination Top Bar */}
                <header className="bg-white border-b px-4 sm:px-6 py-3 flex justify-between items-center shadow-sm">
                  <div>
                    <h1 className="font-bold text-slate-900 text-sm sm:text-base">{activeExam.title}</h1>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Candidate: <strong className="text-slate-800">{studentNameInput}</strong></span>
                      <span>•</span>
                      <span>Q {currentIndex + 1} of {activeExam.questions.length}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Countdown Clock */}
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm sm:text-base font-bold border transition-colors ${
                        timeLeft <= 300
                          ? "bg-rose-50 border-rose-300 text-rose-700 animate-pulse"
                          : "bg-amber-50 border-amber-200 text-amber-900"
                      }`}
                    >
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>{formatTimer(timeLeft)}</span>
                    </div>

                    <button
                      onClick={() => setShowSubmitConfirm(true)}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow-sm transition"
                    >
                      Submit Paper
                    </button>
                  </div>
                </header>

                {/* Main Exam Interface Split */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Left / Center: Question Panel */}
                  <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto">
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
                      <div className="flex justify-between items-center border-b pb-3 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-lg">
                            Question {currentIndex + 1}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            / {activeExam.questions.length}
                          </span>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">
                          +{activeExam.questions[currentIndex]?.marks || 2} / -0 Marks
                        </span>
                      </div>

                      {/* Question Text with LaTeX */}
                      <div className="text-slate-800 text-base sm:text-lg leading-relaxed mb-6 font-normal">
                        <Latex>{activeExam.questions[currentIndex]?.question_text}</Latex>
                      </div>

                      {/* Options */}
                      <div className="space-y-3 mb-6">
                        {activeExam.questions[currentIndex]?.options?.map((opt) => {
                          const isSelected = userAnswers[currentIndex] === opt.key;
                          return (
                            <div
                              key={opt.key}
                              onClick={() => selectOption(opt.key)}
                              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                                isSelected
                                  ? "bg-indigo-50/70 border-indigo-600 ring-1 ring-indigo-600 text-indigo-950 font-medium shadow-sm"
                                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                                  isSelected
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : "border-slate-400 bg-white"
                                }`}
                              >
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <div className="text-sm sm:text-base leading-relaxed">
                                <span className="font-bold mr-2 text-slate-900">({opt.key})</span>
                                <Latex>{opt.text}</Latex>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom Navigation & Action Bar */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 mt-4 flex flex-wrap justify-between items-center gap-3 shadow-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={handleMarkForReview}
                          className="flex items-center gap-1.5 px-3.5 py-2 border border-purple-200 bg-purple-50 text-purple-700 rounded-xl text-xs sm:text-sm font-semibold hover:bg-purple-100 transition"
                        >
                          <Bookmark className="w-4 h-4" />
                          <span>Mark for Review</span>
                        </button>
                        <button
                          onClick={clearCurrentResponse}
                          className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-100 transition"
                        >
                          Clear Response
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          disabled={currentIndex === 0}
                          onClick={() => navigateQuestion(currentIndex - 1)}
                          className="flex items-center gap-1 px-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-50 transition"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Previous</span>
                        </button>
                        <button
                          onClick={handleSaveAndNext}
                          className="flex items-center gap-1 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-100 transition"
                        >
                          <span>Save & Next</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Question Palette Sidebar */}
                  <aside className="w-72 lg:w-80 bg-white border-l border-slate-200 flex flex-col p-4">
                    <div className="flex items-center justify-between border-b pb-3 mb-3">
                      <h3 className="font-bold text-slate-900 text-sm">Question Palette</h3>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {Object.keys(userAnswers).length} / {activeExam.questions.length} Done
                      </span>
                    </div>

                    {/* Question Matrix */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      <div className="grid grid-cols-5 gap-2">
                        {activeExam.questions.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => navigateQuestion(idx)}
                            className={getPaletteStyle(idx)}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Palette Legend */}
                    <div className="border-t pt-4 mt-3 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded bg-emerald-600"></div>
                          <span>Answered</span>
                        </div>
                        <span className="font-bold font-mono">
                          {Object.values(questionStatus).filter(v => v === 'answered').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded bg-rose-500"></div>
                          <span>Not Answered</span>
                        </div>
                        <span className="font-bold font-mono">
                          {Object.values(questionStatus).filter(v => v === 'visited').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded bg-purple-600"></div>
                          <span>Marked for Review</span>
                        </div>
                        <span className="font-bold font-mono">
                          {Object.values(questionStatus).filter(v => v === 'review' || v === 'answered_review').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300"></div>
                          <span>Not Visited</span>
                        </div>
                        <span className="font-bold font-mono">
                          {activeExam.questions.length - Object.keys(questionStatus).length}
                        </span>
                      </div>
                    </div>
                  </aside>
                </div>

                {/* Submit Confirmation Dialog Modal */}
                {showSubmitConfirm && (
                  <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 animate-scaleIn">
                      <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-center text-slate-900 mb-1">Final Submission Confirmation</h3>
                      <p className="text-xs text-center text-slate-500 mb-6">
                        Are you sure you want to finish and submit your answers? Once submitted, your scores will be calculated automatically.
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-center text-xs bg-slate-50 rounded-xl p-3 border mb-6">
                        <div className="p-2">
                          <span className="text-slate-500">Attempted</span>
                          <p className="text-lg font-bold text-emerald-600">{Object.keys(userAnswers).length}</p>
                        </div>
                        <div className="p-2">
                          <span className="text-slate-500">Unattempted</span>
                          <p className="text-lg font-bold text-slate-700">{activeExam.questions.length - Object.keys(userAnswers).length}</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowSubmitConfirm(false)}
                          className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Return to Test
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => submitExamToBackend(false)}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                        >
                          {isSubmitting ? "Grading..." : "Yes, Submit Paper"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* =================================================================
             ADMIN & EXAMINER PORTAL
             ================================================================= */
          <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex-1 flex flex-col">
            {/* Admin Sub Navigation Tabs */}
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAdminTab('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
                    adminTab === 'upload'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Create Exam</span>
                </button>
                <button
                  onClick={() => {
                    setAdminTab('dashboard');
                    if (adminLoggedIn) fetchAdminExams();
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
                    adminTab === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Admin Dashboard</span>
                </button>
              </div>

              {adminLoggedIn && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500 hidden sm:inline">
                    Examiner: <strong className="text-slate-800">{adminName}</strong>
                  </span>
                  <button
                    onClick={handleAdminLogout}
                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: UPLOAD & CREATE EXAM */}
            {adminTab === 'upload' && (
              <div className="flex-1 flex flex-col">
                {publishedExam ? (
                  /* Success Screen after Exam Publish */
                  <div className="max-w-xl mx-auto w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center my-auto">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                      <CheckCheck className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">Exam Published Successfully!</h3>
                    <p className="text-slate-500 text-sm mt-1 mb-6">
                      Your examination booklet has been saved and is now ready for students.
                    </p>

                    {/* Access Code Card */}
                    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border-2 border-indigo-200 rounded-2xl p-6 mb-6">
                      <span className="text-xs uppercase font-bold text-indigo-700 tracking-wider">
                        Student Access Code
                      </span>
                      <div className="text-3xl sm:text-4xl font-mono font-black text-indigo-900 my-2 tracking-wider">
                        {publishedExam.access_code}
                      </div>
                      <p className="text-xs text-indigo-600">
                        Share this code or direct URL with candidates to begin the test
                      </p>

                      <div className="flex gap-2 justify-center mt-4">
                        <button
                          onClick={() => copyToClipboard(publishedExam.access_code, "Access code copied!")}
                          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition"
                        >
                          <Copy className="w-4 h-4" /> Copy Code
                        </button>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `${window.location.origin}/?code=${publishedExam.access_code}`,
                              "Direct student test link copied!"
                            )
                          }
                          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-indigo-300 hover:bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold transition"
                        >
                          <Share2 className="w-4 h-4" /> Copy Direct Link
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => {
                          setPublishedExam(null);
                          setEditableExam(null);
                        }}
                        className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Upload Another Paper
                      </button>
                      <button
                        onClick={() => {
                          setAdminTab('dashboard');
                          setAdminLoggedIn(true);
                          fetchAdminExams();
                        }}
                        className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <BarChart3 className="w-4 h-4" /> View in Dashboard
                      </button>
                    </div>
                  </div>
                ) : !editableExam ? (
                  /* Create Exam Options: AI PDF Upload OR Manual Authoring */
                  <div className="max-w-4xl mx-auto w-full my-auto space-y-6">
                    <div className="text-center">
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Create & Publish Examination</h2>
                      <p className="text-slate-500 text-sm mt-1">
                        Choose how you would like to prepare your examination questions
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Option 1: AI PDF Digitizer */}
                      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-between hover:border-indigo-400 transition">
                        <div>
                          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                            <UploadCloud className="w-7 h-7" />
                          </div>
                          <h3 className="text-xl font-black text-slate-900 mb-1">Upload Question Paper PDF</h3>
                          <p className="text-slate-500 text-xs sm:text-sm mb-6 leading-relaxed">
                            Upload an existing PDF booklet. Gemini AI will extract all questions, options, LaTeX math equations, and answer keys automatically.
                          </p>
                        </div>

                        <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-5 flex flex-col items-center justify-center bg-slate-50/50 transition">
                          <label className="cursor-pointer w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-md text-xs sm:text-sm transition flex items-center justify-center gap-2">
                            {uploadLoading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" /> Digitizing with Gemini AI...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" /> Select PDF Question Booklet
                              </>
                            )}
                            <input
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={handlePdfUpload}
                              disabled={uploadLoading}
                            />
                          </label>
                          <span className="text-[11px] text-slate-400 mt-2 text-center">Accepts national & university test booklets (.pdf)</span>
                        </div>
                      </div>

                      {/* Option 2: Manual Question Creation */}
                      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-between hover:border-violet-400 transition">
                        <div>
                          <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center mb-4">
                            <Edit3 className="w-7 h-7" />
                          </div>
                          <h3 className="text-xl font-black text-slate-900 mb-1">Create Exam Manually</h3>
                          <p className="text-slate-500 text-xs sm:text-sm mb-6 leading-relaxed">
                            Author questions manually from scratch. Write question descriptions, enter 4 options (A, B, C, D), mark the correct answer key, and format math using LaTeX.
                          </p>
                        </div>

                        <div className="p-5 bg-slate-50/50 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
                          <button
                            type="button"
                            onClick={handleStartManualExam}
                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md text-xs sm:text-sm transition flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Start Adding Questions Manually
                          </button>
                          <span className="text-[11px] text-slate-400 mt-2 text-center">Full control over questions, options, marks & timing</span>
                        </div>
                      </div>
                    </div>

                    {uploadError && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Live Question Paper & Answer Key Editor */
                  <div className="space-y-6">
                    {/* Header Bar */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-900">Review & Edit Exam Paper</h2>
                        <p className="text-xs text-slate-500">
                          Verify extracted questions, change answer keys, customize marks, and set your admin credentials.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenEditableAnswerKey}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-md shadow-amber-100 text-xs transition flex items-center gap-1.5"
                          title="Paste or set all answer keys at once"
                        >
                          <Key className="w-4 h-4" />
                          <span>
                            Set All Answer Keys ({editableExam.questions?.filter(q => !!q.correct_answer)?.length || 0}/{editableExam.questions?.length || 0})
                          </span>
                        </button>
                        <button
                          onClick={() => setEditableExam(null)}
                          className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Discard
                        </button>
                        <button
                          onClick={handlePublishExam}
                          disabled={saveLoading}
                          className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-md shadow-indigo-100 text-xs transition flex items-center gap-1.5"
                        >
                          {saveLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          <span>Publish & Get Access Code</span>
                        </button>
                      </div>
                    </div>

                    {/* Exam Metadata & Admin Credentials Form */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Exam Title *
                        </label>
                        <input
                          type="text"
                          value={editableExam.title}
                          onChange={(e) => setEditableExam({ ...editableExam, title: e.target.value })}
                          className="w-full text-sm font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Duration (Minutes) *
                        </label>
                        <input
                          type="number"
                          value={editableExam.time_limit_minutes}
                          onChange={(e) =>
                            setEditableExam({ ...editableExam, time_limit_minutes: parseInt(e.target.value) || 60 })
                          }
                          className="w-full text-sm font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Admin / Examiner Name *
                        </label>
                        <input
                          type="text"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="e.g. Prof. Sharma"
                          className="w-full text-sm font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Admin Passcode *
                        </label>
                        <input
                          type="password"
                          value={adminPasscode}
                          onChange={(e) => setAdminPasscode(e.target.value)}
                          placeholder="Secret key for dashboard"
                          className="w-full text-sm font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Bulk Answer Key Action Banner */}
                    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-md shadow-amber-200">
                          <Key className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-extrabold text-amber-950">Bulk Answer Key Provider</h4>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              (editableExam.questions?.filter(q => !!q.correct_answer)?.length || 0) === (editableExam.questions?.length || 0) && editableExam.questions?.length > 0
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-900 border border-amber-300"
                            }`}>
                              {editableExam.questions?.filter(q => !!q.correct_answer)?.length || 0} of {editableExam.questions?.length || 0} Marked
                            </span>
                          </div>
                          <p className="text-xs text-amber-800 mt-0.5">
                            Skip manual option selection! Paste an entire answer key sheet (e.g. 1-A, 2-B, 3-C or A, B, C...) or use the rapid keypad matrix.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenEditableAnswerKey}
                        className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-200 transition flex items-center justify-center gap-1.5 flex-shrink-0"
                      >
                        <Zap className="w-4 h-4 text-amber-200" />
                        <span>Provide All Answer Keys</span>
                      </button>
                    </div>

                    {/* Manual Question & 4 Options Input Box */}
                    <div className="bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/60 rounded-2xl border-2 border-indigo-200 p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-center border-b border-indigo-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-sm">
                            +
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                              Add Question & 4 Options Manually
                            </h3>
                            <p className="text-xs text-slate-500">
                              Write question description, fill 4 options (A, B, C, D), and select the correct answer key
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-700">Marks:</span>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={newQuestionDraft.marks}
                            onChange={(e) => setNewQuestionDraft({ ...newQuestionDraft, marks: e.target.value })}
                            className="w-16 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-800"
                          />
                        </div>
                      </div>

                      {/* Question Description */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Question Description (use $...$ for LaTeX math):
                        </label>
                        <textarea
                          rows={2}
                          value={newQuestionDraft.question_text}
                          onChange={(e) => setNewQuestionDraft({ ...newQuestionDraft, question_text: e.target.value })}
                          placeholder="e.g. Which of the following is the derivative of $f(x) = \sin(x)$?"
                          className="w-full text-sm p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 font-sans"
                        />
                        {newQuestionDraft.question_text && (
                          <div className="mt-1.5 p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-slate-800">
                            <span className="font-bold text-[10px] uppercase text-indigo-700 mr-2">Live Math Preview:</span>
                            <Latex>{newQuestionDraft.question_text}</Latex>
                          </div>
                        )}
                      </div>

                      {/* 4 Options Grid */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          4 Options & Correct Answer Key:
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {newQuestionDraft.options.map((opt, oIdx) => {
                            const isSelectedKey = newQuestionDraft.correct_answer === opt.key;
                            return (
                              <div
                                key={opt.key}
                                className={`p-3.5 rounded-xl border transition-all ${
                                  isSelectedKey
                                    ? "bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400 shadow-sm"
                                    : "bg-white border-slate-200"
                                }`}
                              >
                                <div className="flex justify-between items-center text-xs mb-1.5">
                                  <span className="font-bold text-slate-900">Option ({opt.key})</span>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="draft_correct_radio"
                                      checked={isSelectedKey}
                                      onChange={() => setNewQuestionDraft({ ...newQuestionDraft, correct_answer: opt.key })}
                                      className="text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className={`text-[11px] font-bold ${isSelectedKey ? "text-emerald-700" : "text-slate-500 hover:text-slate-700"}`}>
                                      {isSelectedKey ? "✓ Correct Answer" : "Mark as Correct"}
                                    </span>
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => {
                                    const nextOpts = [...newQuestionDraft.options];
                                    nextOpts[oIdx].text = e.target.value;
                                    setNewQuestionDraft({ ...newQuestionDraft, options: nextOpts });
                                  }}
                                  placeholder={`Enter option (${opt.key}) text...`}
                                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                                />
                                {opt.text && opt.text.includes('$') && (
                                  <div className="mt-1 text-[11px] text-slate-600">
                                    <Latex>{opt.text}</Latex>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleAddDraftQuestion}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-100 text-xs transition flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" /> Add Question to Paper
                        </button>
                      </div>
                    </div>

                    {/* Question List Accordion */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-900 text-sm">
                          Exam Questions ({editableExam.questions.length})
                        </h3>
                      </div>

                      {editableExam.questions.length === 0 && (
                        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
                          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
                          <p className="text-sm font-semibold text-slate-700">No questions in this exam yet.</p>
                          <p className="text-xs text-slate-500 mt-1">Use the "Add Question & 4 Options Manually" card above to add Question #1.</p>
                        </div>
                      )}

                      {editableExam.questions.map((q, qIdx) => (
                        <div key={qIdx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                                Question {qIdx + 1}
                              </span>
                              {q.correct_answer ? (
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                  <Check className="w-3.5 h-3.5" /> Key: Option ({q.correct_answer})
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                  No Key Set
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-slate-500 font-medium">Marks:</span>
                                <input
                                  type="number"
                                  value={q.marks}
                                  onChange={(e) => {
                                    const updated = [...editableExam.questions];
                                    updated[qIdx].marks = parseFloat(e.target.value) || 1;
                                    setEditableExam({ ...editableExam, questions: updated });
                                  }}
                                  className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center font-bold"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = editableExam.questions.filter((_, i) => i !== qIdx);
                                  setEditableExam({ ...editableExam, questions: updated });
                                }}
                                className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Question Text Editor & Live LaTeX Preview */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Question Text (use $...$ for LaTeX math):
                            </label>
                            <textarea
                              rows={2}
                              value={q.question_text}
                              onChange={(e) => {
                                const updated = [...editableExam.questions];
                                updated[qIdx].question_text = e.target.value;
                                setEditableExam({ ...editableExam, questions: updated });
                              }}
                              className="w-full text-sm p-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-mono"
                            />
                            {q.question_text && (
                              <div className="mt-1 p-2 bg-indigo-50/40 rounded-lg border border-indigo-100 text-xs text-slate-800">
                                <span className="font-bold text-[10px] uppercase text-indigo-600 mr-2">Preview:</span>
                                <Latex>{q.question_text}</Latex>
                              </div>
                            )}
                          </div>

                          {/* Options and Answer Key Selector */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.options?.map((opt, optIdx) => (
                              <div key={opt.key} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-800">Option ({opt.key})</span>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`correct_${qIdx}`}
                                      checked={q.correct_answer === opt.key}
                                      onChange={() => {
                                        const updated = [...editableExam.questions];
                                        updated[qIdx].correct_answer = opt.key;
                                        setEditableExam({ ...editableExam, questions: updated });
                                      }}
                                      className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className={`text-[11px] font-bold ${q.correct_answer === opt.key ? "text-emerald-600" : "text-slate-500"}`}>
                                      {q.correct_answer === opt.key ? "Correct Answer" : "Mark as Correct"}
                                    </span>
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => {
                                    const updated = [...editableExam.questions];
                                    updated[qIdx].options[optIdx].text = e.target.value;
                                    setEditableExam({ ...editableExam, questions: updated });
                                  }}
                                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ADMIN DASHBOARD */}
            {adminTab === 'dashboard' && (
              <div className="flex-1 flex flex-col">
                {!adminLoggedIn ? (
                  /* Admin Login Card */
                  <div className="max-w-md mx-auto w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 my-auto">
                    <div className="text-center mb-6">
                      <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <ShieldCheck className="w-7 h-7" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900">Admin Dashboard Login</h2>
                      <p className="text-slate-500 text-xs mt-1">
                        Sign in to view your exams, inspect participant scores, and download summary CSV reports
                      </p>
                    </div>

                    <form onSubmit={handleAdminLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Admin / Examiner Name
                        </label>
                        <input
                          type="text"
                          required
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="e.g. Prof. Sharma"
                          className="w-full text-sm px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Admin Passcode
                        </label>
                        <input
                          type="password"
                          required
                          value={adminPasscode}
                          onChange={(e) => setAdminPasscode(e.target.value)}
                          placeholder="Enter your passcode"
                          className="w-full text-sm px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                        />
                      </div>

                      {dashboardError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{dashboardError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={dashboardLoading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2"
                      >
                        {dashboardLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        <span>Access Admin Dashboard</span>
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Admin Logged In Overview */
                  <div className="space-y-6">
                    {/* Metrics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 font-medium">Exams Created</span>
                          <h4 className="text-2xl font-black text-slate-900">{adminExamsList.length}</h4>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 font-medium">Total Candidate Attempts</span>
                          <h4 className="text-2xl font-black text-slate-900">
                            {adminExamsList.reduce((acc, ex) => acc + (ex.participant_count || 0), 0)}
                          </h4>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
                          <Award className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 font-medium">Active Examiner</span>
                          <h4 className="text-lg font-bold text-slate-900 truncate max-w-[180px]">{adminName}</h4>
                        </div>
                      </div>
                    </div>

                    {/* Exams List Table / Cards */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">Your Managed Examinations</h3>
                          <p className="text-xs text-slate-500">Live test booklets, participant counts, and reports</p>
                        </div>
                        <button
                          onClick={fetchAdminExams}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </button>
                      </div>

                      {adminExamsList.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                          <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">No exams published yet under this admin account.</p>
                          <button
                            onClick={() => setAdminTab('upload')}
                            className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            + Upload and Create an Exam
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {adminExamsList.map((exam) => (
                            <div
                              key={exam.id}
                              className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
                            >
                              <div>
                                <div className="flex items-center gap-2.5">
                                  <h4 className="font-extrabold text-slate-900 text-base">{exam.title}</h4>
                                  <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                                    {exam.access_code}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                                  <span>{exam.questions_count} Questions</span>
                                  <span>•</span>
                                  <span>{exam.time_limit_minutes} Mins</span>
                                  <span>•</span>
                                  <span>Total Marks: {exam.total_marks}</span>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                                    {exam.participant_count} Submissions
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      `${window.location.origin}/?code=${exam.access_code}`,
                                      "Student test link copied!"
                                    )
                                  }
                                  className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl transition"
                                  title="Share Link"
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenDashboardAnswerKey(exam)}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold transition"
                                  title="Set or update answer key for this exam"
                                >
                                  <Key className="w-3.5 h-3.5 text-amber-600" /> Answer Key
                                </button>
                                <button
                                  onClick={() => downloadExamCsv(exam.id, exam.title)}
                                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
                                >
                                  <Download className="w-3.5 h-3.5" /> CSV Report
                                </button>
                                <button
                                  onClick={() => viewExamDetails(exam.id)}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition"
                                >
                                  <Users className="w-3.5 h-3.5" /> View Participants
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Drilldown Submissions Modal / Drawer */}
                    {selectedExamDetails && (
                      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="max-w-4xl w-full max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scaleIn">
                          <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-slate-900 text-lg">
                                  {selectedExamDetails.title}
                                </h3>
                                <span className="font-mono text-xs font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                                  {selectedExamDetails.access_code}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Submissions & Participant Leaderboard ({selectedExamDetails.submissions?.length || 0} students)
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => downloadExamCsv(selectedExamDetails.id, selectedExamDetails.title)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                              >
                                <Download className="w-3.5 h-3.5" /> Download CSV
                              </button>
                              <button
                                onClick={() => setSelectedExamDetails(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto p-6">
                            {selectedExamDetails.submissions?.length === 0 ? (
                              <div className="text-center py-12 text-slate-400">
                                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                <p className="text-sm font-medium">No students have taken this examination yet.</p>
                                <p className="text-xs mt-1">Share the access code <strong>{selectedExamDetails.access_code}</strong> to receive submissions.</p>
                              </div>
                            ) : (
                              <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 border-b text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                      <th className="py-3 px-4">Rank</th>
                                      <th className="py-3 px-4">Candidate</th>
                                      <th className="py-3 px-4">Roll / ID</th>
                                      <th className="py-3 px-4">Score</th>
                                      <th className="py-3 px-4">Percentage</th>
                                      <th className="py-3 px-4">Time Taken</th>
                                      <th className="py-3 px-4">Submitted At</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {selectedExamDetails.submissions?.map((sub, sIdx) => (
                                      <tr key={sub.id} className="hover:bg-slate-50">
                                        <td className="py-3 px-4 font-bold text-slate-800">#{sIdx + 1}</td>
                                        <td className="py-3 px-4 font-bold text-slate-900">{sub.student_name}</td>
                                        <td className="py-3 px-4 text-slate-500 font-mono">{sub.student_id || "—"}</td>
                                        <td className="py-3 px-4 font-bold text-emerald-600">
                                          {sub.score} / {sub.total_marks}
                                        </td>
                                        <td className="py-3 px-4">
                                          <span className="font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                            {sub.percentage}%
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">
                                          {Math.floor(sub.time_taken_seconds / 60)}m {sub.time_taken_seconds % 60}s
                                        </td>
                                        <td className="py-3 px-4 text-slate-400">
                                          {sub.submitted_at?.slice(0, 16).replace("T", " ")}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bulk Answer Key Modal Suite */}
      <BulkAnswerKeyModal
        isOpen={showAnswerKeyModal}
        onClose={() => setShowAnswerKeyModal(false)}
        questions={
          answerKeyContext === 'editable'
            ? (editableExam?.questions || [])
            : (editingDashboardExam?.questions || [])
        }
        examTitle={
          answerKeyContext === 'editable'
            ? (editableExam?.title || "Exam Paper")
            : (editingDashboardExam?.title || "Exam Paper")
        }
        onApply={handleApplyModalAnswerKeys}
        isSaving={savingKeyLoading}
        apiBase={API_BASE}
        showToast={showToast}
      />
    </div>
  );
}