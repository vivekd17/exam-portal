import sqlite3
import json
import random
import string
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "exam_portal.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Exams table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exams (
            id TEXT PRIMARY KEY,
            access_code TEXT UNIQUE NOT NULL,
            admin_name TEXT NOT NULL,
            admin_passcode TEXT NOT NULL,
            title TEXT NOT NULL,
            time_limit_minutes INTEGER NOT NULL DEFAULT 120,
            total_marks REAL NOT NULL DEFAULT 100,
            questions_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    
    # Submissions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id TEXT NOT NULL,
            student_name TEXT NOT NULL,
            student_id TEXT,
            score REAL NOT NULL,
            total_marks REAL NOT NULL,
            percentage REAL NOT NULL,
            answers_json TEXT NOT NULL,
            time_taken_seconds INTEGER DEFAULT 0,
            submitted_at TEXT NOT NULL,
            FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
        )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_exams_code ON exams(access_code)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_exams_admin ON exams(admin_name, admin_passcode)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_submissions_exam ON submissions(exam_id)")
    
    conn.commit()
    conn.close()

def generate_access_code(prefix: str = "EXAM") -> str:
    """Generate a clean, memorable access code like EXAM-8492"""
    digits = ''.join(random.choices(string.digits, k=4))
    letters = ''.join(random.choices(string.ascii_uppercase, k=2))
    return f"{prefix}-{letters}{digits}"

def save_new_exam(admin_name: str, admin_passcode: str, title: str, 
                  time_limit_minutes: int, total_marks: float, questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    exam_id = f"exam_{''.join(random.choices(string.ascii_lowercase + string.digits, k=10))}"
    
    # Ensure unique access code
    for _ in range(10):
        code = generate_access_code()
        cursor.execute("SELECT id FROM exams WHERE access_code = ?", (code,))
        if not cursor.fetchone():
            break
            
    now = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO exams (id, access_code, admin_name, admin_passcode, title, time_limit_minutes, total_marks, questions_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        exam_id,
        code,
        admin_name.strip(),
        admin_passcode.strip(),
        title.strip(),
        int(time_limit_minutes),
        float(total_marks),
        json.dumps(questions),
        now,
        now
    ))
    
    conn.commit()
    conn.close()
    
    return {
        "id": exam_id,
        "access_code": code,
        "admin_name": admin_name,
        "title": title,
        "time_limit_minutes": time_limit_minutes,
        "total_marks": total_marks,
        "questions_count": len(questions)
    }

def update_exam(exam_id: str, admin_name: str, admin_passcode: str, title: str,
                time_limit_minutes: int, total_marks: float, questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM exams WHERE id = ?", (exam_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError("Exam not found")
        
    if row["admin_name"].lower() != admin_name.strip().lower() or row["admin_passcode"] != admin_passcode.strip():
        conn.close()
        raise PermissionError("Invalid admin credentials for this exam")
        
    now = datetime.now().isoformat()
    cursor.execute("""
        UPDATE exams 
        SET title = ?, time_limit_minutes = ?, total_marks = ?, questions_json = ?, updated_at = ?
        WHERE id = ?
    """, (
        title.strip(),
        int(time_limit_minutes),
        float(total_marks),
        json.dumps(questions),
        now,
        exam_id
    ))
    
    conn.commit()
    conn.close()
    
    return {
        "id": exam_id,
        "access_code": row["access_code"],
        "title": title,
        "time_limit_minutes": time_limit_minutes,
        "total_marks": total_marks,
        "questions_count": len(questions)
    }

def get_admin_exams(admin_name: str, admin_passcode: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT e.*, 
               COUNT(s.id) as participant_count,
               AVG(s.score) as avg_score,
               MAX(s.score) as max_score
        FROM exams e
        LEFT JOIN submissions s ON e.id = s.exam_id
        WHERE LOWER(e.admin_name) = LOWER(?) AND e.admin_passcode = ?
        GROUP BY e.id
        ORDER BY e.created_at DESC
    """, (admin_name.strip(), admin_passcode.strip()))
    
    rows = cursor.fetchall()
    exams = []
    for r in rows:
        q_list = json.loads(r["questions_json"])
        exams.append({
            "id": r["id"],
            "access_code": r["access_code"],
            "title": r["title"],
            "time_limit_minutes": r["time_limit_minutes"],
            "total_marks": r["total_marks"],
            "questions_count": len(q_list),
            "participant_count": r["participant_count"] or 0,
            "avg_score": round(r["avg_score"] or 0, 1),
            "max_score": round(r["max_score"] or 0, 1),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"]
        })
        
    conn.close()
    return exams

def get_exam_details_for_admin(exam_id: str, admin_name: str, admin_passcode: str) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM exams WHERE id = ?", (exam_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError("Exam not found")
        
    if row["admin_name"].lower() != admin_name.strip().lower() or row["admin_passcode"] != admin_passcode.strip():
        conn.close()
        raise PermissionError("Invalid admin credentials")
        
    questions = json.loads(row["questions_json"])
    
    # Fetch submissions
    cursor.execute("""
        SELECT * FROM submissions 
        WHERE exam_id = ? 
        ORDER BY score DESC, submitted_at ASC
    """, (exam_id,))
    sub_rows = cursor.fetchall()
    
    submissions = []
    for s in sub_rows:
        submissions.append({
            "id": s["id"],
            "student_name": s["student_name"],
            "student_id": s["student_id"],
            "score": s["score"],
            "total_marks": s["total_marks"],
            "percentage": s["percentage"],
            "time_taken_seconds": s["time_taken_seconds"],
            "submitted_at": s["submitted_at"]
        })
        
    conn.close()
    return {
        "id": row["id"],
        "access_code": row["access_code"],
        "admin_name": row["admin_name"],
        "title": row["title"],
        "time_limit_minutes": row["time_limit_minutes"],
        "total_marks": row["total_marks"],
        "questions": questions,
        "submissions": submissions,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }

def get_exam_for_student(access_code: str) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    clean_code = access_code.strip().upper()
    cursor.execute("SELECT * FROM exams WHERE UPPER(access_code) = ?", (clean_code,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError("Invalid exam access code. Please check and try again.")
        
    questions = json.loads(row["questions_json"])
    
    # Strip correct_answer to prevent student cheating
    student_questions = []
    for q in questions:
        student_questions.append({
            "question_number": q.get("question_number"),
            "question_text": q.get("question_text"),
            "options": q.get("options", []),
            "marks": q.get("marks", 2)
        })
        
    conn.close()
    return {
        "id": row["id"],
        "access_code": row["access_code"],
        "title": row["title"],
        "time_limit_minutes": row["time_limit_minutes"],
        "total_marks": row["total_marks"],
        "questions": student_questions
    }

def submit_student_exam(exam_id: str, student_name: str, student_id: Optional[str], 
                        answers: Dict[str, str], time_taken_seconds: int = 0) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM exams WHERE id = ?", (exam_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError("Exam not found")
        
    questions = json.loads(row["questions_json"])
    
    total_marks = 0.0
    obtained_score = 0.0
    detailed_results = []
    
    for idx, q in enumerate(questions):
        q_marks = float(q.get("marks", 2))
        total_marks += q_marks
        
        correct_key = (q.get("correct_answer") or "").strip().upper()
        # Student answer might be keyed by index string or int
        student_choice = (answers.get(str(idx)) or answers.get(idx) or "").strip().upper()
        
        is_correct = False
        if correct_key and student_choice == correct_key:
            is_correct = True
            obtained_score += q_marks
            
        detailed_results.append({
            "question_number": q.get("question_number", idx + 1),
            "question_text": q.get("question_text"),
            "options": q.get("options", []),
            "student_choice": student_choice if student_choice else None,
            "correct_answer": correct_key if correct_key else "Not Specified",
            "is_correct": is_correct,
            "marks_awarded": q_marks if is_correct else 0,
            "marks_possible": q_marks
        })
        
    percentage = round((obtained_score / total_marks * 100), 1) if total_marks > 0 else 0.0
    now = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO submissions (exam_id, student_name, student_id, score, total_marks, percentage, answers_json, time_taken_seconds, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        exam_id,
        student_name.strip(),
        (student_id or "").strip(),
        obtained_score,
        total_marks,
        percentage,
        json.dumps(answers),
        time_taken_seconds,
        now
    ))
    
    submission_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {
        "submission_id": submission_id,
        "student_name": student_name,
        "score": obtained_score,
        "total_marks": total_marks,
        "percentage": percentage,
        "time_taken_seconds": time_taken_seconds,
        "submitted_at": now,
        "detailed_results": detailed_results
    }

def export_exam_csv(exam_id: str, admin_name: str, admin_passcode: str) -> str:
    """Generate CSV string of participants summary report"""
    data = get_exam_details_for_admin(exam_id, admin_name, admin_passcode)
    
    lines = [
        f"Exam Title,{data['title']}",
        f"Access Code,{data['access_code']}",
        f"Admin,{data['admin_name']}",
        f"Total Questions,{len(data['questions'])}",
        f"Total Marks,{data['total_marks']}",
        "",
        "Rank,Student Name,Student ID / Roll No,Score Obtained,Total Marks,Percentage (%),Time Taken (Min:Sec),Submitted Date"
    ]
    
    for rank, sub in enumerate(data["submissions"], start=1):
        secs = sub["time_taken_seconds"] or 0
        mins = secs // 60
        rem_secs = secs % 60
        time_str = f"{mins:02d}:{rem_secs:02d}"
        
        # Clean CSV values
        s_name = f'"{sub["student_name"]}"'
        s_id = f'"{sub["student_id"] or "N/A"}"'
        date_str = sub["submitted_at"][:19].replace("T", " ")
        
        lines.append(f'{rank},{s_name},{s_id},{sub["score"]},{sub["total_marks"]},{sub["percentage"]}%,{time_str},{date_str}')
        
    return "\n".join(lines)
