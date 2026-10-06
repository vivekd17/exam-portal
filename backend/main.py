import os
import re
import json
import tempfile
import traceback
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from dotenv import load_dotenv
import json_repair

import database

load_dotenv()

# Initialize SQLite database
database.init_db()

app = FastAPI(title="Exam Engine API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("\n[CRITICAL ERROR] GEMINI_API_KEY is not found in your environment or .env file!\n")

client = genai.Client(api_key=api_key)

# ----------------- Models -----------------

class OptionItem(BaseModel):
    key: str = Field(description="Option key, e.g., 'A', 'B', 'C', 'D'")
    text: str = Field(description="Option content, math enclosed in $...$")

class QuestionItem(BaseModel):
    question_number: int
    question_text: str = Field(description="Question description with math formulas in LaTeX '$...$'")
    options: List[OptionItem]
    correct_answer: Optional[str] = Field(default=None, description="Option key of correct answer e.g. 'A', 'B'")
    marks: float = 2.0

class ExamData(BaseModel):
    title: str
    time_limit_minutes: int = 120
    total_marks: float = 100.0
    questions: List[QuestionItem]

class SaveExamRequest(BaseModel):
    admin_name: str
    admin_passcode: str
    title: str
    time_limit_minutes: int = 120
    total_marks: float = 100.0
    questions: List[QuestionItem]

class UpdateExamRequest(BaseModel):
    admin_name: str
    admin_passcode: str
    title: str
    time_limit_minutes: int = 120
    total_marks: float = 100.0
    questions: List[QuestionItem]

class AdminLoginRequest(BaseModel):
    admin_name: str
    admin_passcode: str

class SubmitExamRequest(BaseModel):
    student_name: str
    student_id: Optional[str] = ""
    answers: Dict[str, str] = Field(default_factory=dict, description="Map of question index to chosen option key")
    time_taken_seconds: int = 0

class ParseAnswerKeyRequest(BaseModel):
    raw_text: str
    total_questions: Optional[int] = None

class ParsedAnswerKeyResponse(BaseModel):
    status: str = "success"
    answers: Dict[str, str] = Field(default_factory=dict, description="Map of question number string ('1', '2', ...) to correct option key ('A', 'B', 'C', 'D')")
    count: int = 0
    source: str = "regex"

# ----------------- Health Check -----------------

@app.get("/")
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Exam Engine API v2.0"}

# ----------------- Answer Key AI Parser -----------------

@app.post("/api/parse-answer-key", response_model=ParsedAnswerKeyResponse)
async def parse_answer_key_ai(req: ParseAnswerKeyRequest):
    """Extract and parse answer keys from free-form text, tables, or numbered lists using regex + Gemini AI"""
    text = req.raw_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Answer key text cannot be empty.")

    # 1. First attempt: Fast regex extraction for numbered pairs (e.g. 1. A, 1-A, Q1: A, 1) A)
    pair_pattern = re.compile(r'(?:Q(?:uestion)?\s*|#\s*)?(\d+)[\s.:=\-–)]+([A-Da-d])\b', re.IGNORECASE)
    matches = pair_pattern.findall(text)
    if len(matches) >= 2 or (len(matches) == 1 and req.total_questions and req.total_questions <= 1):
        parsed = {str(int(q_num)): opt.upper() for q_num, opt in matches if opt.upper() in ["A", "B", "C", "D"]}
        if parsed:
            return ParsedAnswerKeyResponse(status="success", answers=parsed, count=len(parsed), source="regex")

    # 2. If regex didn't find enough numbered pairs, use Gemini AI if available
    if api_key and client:
        try:
            prompt = (
                "You are an academic exam answer key extractor. "
                "Extract all question numbers and their corresponding correct options from the provided text.\n"
                "Rules:\n"
                "1. Output a JSON object with a single key 'answers' mapping string question numbers ('1', '2', '3', ...) "
                "to their correct answer option uppercase letter ('A', 'B', 'C', or 'D').\n"
                f"2. Note: The exam has {req.total_questions or 'multiple'} questions. "
                "If only option letters are given without numbers, assign them sequentially to questions 1, 2, 3...\n"
                "3. If any option is numeric (e.g., option 1, 2, 3, 4), map 1->A, 2->B, 3->C, 4->D.\n"
                "4. Return strictly valid JSON."
            )
            response = None
            for m_name in [
                "gemini-3.1-flash-lite",
                "gemini-3.1-flash-lite-preview",
                "gemini-3-flash-preview",
                "gemini-3.8-flash"
            ]:
                try:
                    r = client.models.generate_content(
                        model=m_name,
                        contents=[prompt, f"Answer Key Text:\n{text}"],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.1,
                        ),
                    )
                    if r and hasattr(r, "text") and r.text:
                        response = r
                        break
                except Exception as err:
                    print(f"[DEBUG] Model {m_name} failed: {err}")
                    continue
            if response and response.text:
                raw_json = response.text.strip()
                if raw_json.startswith("```"):
                    raw_json = re.sub(r"^```(?:json)?\s*", "", raw_json, flags=re.MULTILINE)
                    raw_json = re.sub(r"\s*```$", "", raw_json, flags=re.MULTILINE).strip()
                parsed_json = json.loads(raw_json)
                answers_map = parsed_json.get("answers") if isinstance(parsed_json, dict) and "answers" in parsed_json else parsed_json
                if isinstance(answers_map, dict):
                    clean_answers = {}
                    for k, v in answers_map.items():
                        try:
                            clean_k = re.sub(r"\D", "", str(k))
                            if clean_k:
                                q_n = str(int(clean_k))
                                v_str = str(v).strip().upper()
                                if v_str in ["A", "B", "C", "D"]:
                                    clean_answers[q_n] = v_str
                        except Exception:
                            pass
                    if clean_answers:
                        return ParsedAnswerKeyResponse(status="success", answers=clean_answers, count=len(clean_answers), source="ai")
        except Exception as e:
            print(f"[WARNING] Gemini answer key extraction failed: {e}")

    # 3. Fallback: Delimited or sequential single letters (e.g. A, B, C, D or ABCD)
    # Check continuous string e.g. ABCDABCD
    no_ws = re.sub(r"\s+", "", text)
    if re.match(r'^[A-Da-d]{2,}$', no_ws):
        clean_answers = {str(i + 1): char.upper() for i, char in enumerate(no_ws)}
        return ParsedAnswerKeyResponse(status="success", answers=clean_answers, count=len(clean_answers), source="continuous")

    tokens = re.split(r'[\s,;|/]+', text)
    letters = [t.upper() for t in tokens if t.upper() in ["A", "B", "C", "D"]]
    if letters:
        clean_answers = {str(i + 1): letter for i, letter in enumerate(letters)}
        return ParsedAnswerKeyResponse(status="success", answers=clean_answers, count=len(clean_answers), source="sequential")

    return ParsedAnswerKeyResponse(status="success", answers={}, count=0, source="empty")

# ----------------- PDF AI Extraction -----------------

@app.post("/api/extract-exam", response_model=ExamData)
async def extract_exam(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    temp_path = None
    uploaded_file = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            contents = await file.read()
            tmp.write(contents)
            temp_path = tmp.name

        print(f"\n[INFO] File saved: {file.filename} ({len(contents) / 1024:.2f} KB)")
        print("[INFO] Uploading to Gemini Files API...")
        
        uploaded_file = client.files.upload(file=temp_path)
        print(f"[INFO] Uploaded successfully as {uploaded_file.name}.")

        prompt = (
            "You are an academic exam digitizer. Extract multiple-choice questions from this question paper booklet.\n"
            "Rules:\n"
            "1. Extract exam title, total minutes allowed, and total marks from the cover.\n"
            "2. Extract questions sequentially with their options (A, B, C, D).\n"
            "3. If any answer key or marked correct answers exist in the paper booklet, populate correct_answer with 'A', 'B', 'C', or 'D'. Otherwise leave correct_answer as null.\n"
            "4. Format all math formulas, chemical symbols, variables, and logic using LaTeX syntax enclosed in '$...$'.\n"
            "5. Extract ALL multiple-choice questions present in the booklet sequentially from Question 1 to the end without stopping or skipping questions.\n"
            "6. CRITICAL: Ensure output is 100% valid JSON matching the schema. Properly escape backslashes in all LaTeX formulas (e.g. \\\\frac, \\\\theta) and do NOT leave trailing commas."
        )

        models_to_try = [
            "gemini-3-flash-preview",
            "gemini-3.8-flash",
            "gemini-3.1-flash-lite",
            "gemini-3.1-flash-lite-preview",
            "gemini-2.5-flash",
        ]
        response = None
        last_error = None
        for model_name in models_to_try:
            try:
                print(f"[INFO] Attempting extraction with model: {model_name}...")
                response = client.models.generate_content(
                    model=model_name,
                    contents=[uploaded_file, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=ExamData,
                        temperature=0.1,
                        max_output_tokens=65536
                    ),
                )
                if response and (getattr(response, "text", None) or getattr(response, "parsed", None)):
                    print(f"[INFO] Successfully generated response using {model_name}")
                    break
            except Exception as err:
                print(f"[WARNING] Model {model_name} failed: {err}")
                last_error = err

        if not response:
            raise last_error

        parsed_data = None

        # 1. Prefer SDK's pre-parsed Pydantic response if valid
        if getattr(response, "parsed", None):
            try:
                if hasattr(response.parsed, "model_dump"):
                    parsed_data = response.parsed.model_dump()
                elif isinstance(response.parsed, dict):
                    parsed_data = response.parsed
                print(f"[INFO] Successfully retrieved structured data via response.parsed")
            except Exception as pe:
                print(f"[WARNING] Failed extracting response.parsed: {pe}")

        # 2. If response.parsed is not available or failed, parse response.text
        if not parsed_data and hasattr(response, "text") and response.text:
            raw_text = response.text.strip()
            # Strip markdown code blocks if wrapped
            if raw_text.startswith("```"):
                raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE)
                raw_text = re.sub(r"\s*```$", "", raw_text, flags=re.MULTILINE).strip()

            try:
                parsed_data = json.loads(raw_text)
            except Exception as je:
                print(f"[WARNING] Standard json.loads failed ({je}). Attempting repair via json_repair...")
                try:
                    repaired = json_repair.loads(raw_text)
                    if isinstance(repaired, dict):
                        parsed_data = repaired
                        print("[INFO] json_repair successfully recovered structured JSON!")
                    else:
                        raise ValueError("json_repair did not return a dictionary object")
                except Exception as re_err:
                    print(f"[ERROR] json_repair also failed: {re_err}")
                    raise je

        if not parsed_data or not isinstance(parsed_data, dict):
            raise ValueError("No valid structured content returned from AI model.")

        # 3. Clean and sanitize questions
        raw_questions = parsed_data.get("questions") or []
        valid_questions = []
        for idx, q in enumerate(raw_questions):
            if not isinstance(q, dict):
                continue
            q_text = str(q.get("question_text") or "").strip()
            if not q_text:
                continue

            opts = q.get("options") or []
            valid_opts = []
            for opt in opts:
                if isinstance(opt, dict) and opt.get("key"):
                    valid_opts.append({
                        "key": str(opt["key"]).strip().upper(),
                        "text": str(opt.get("text") or "").strip()
                    })

            if len(valid_opts) >= 2:
                valid_questions.append({
                    "question_number": int(q.get("question_number") or (idx + 1)),
                    "question_text": q_text,
                    "options": valid_opts,
                    "correct_answer": (q.get("correct_answer") or "").strip().upper() if q.get("correct_answer") else None,
                    "marks": float(q.get("marks") or 2.0)
                })

        parsed_data["questions"] = valid_questions
        parsed_data["title"] = str(parsed_data.get("title") or "Academic Question Paper").strip()
        parsed_data["time_limit_minutes"] = int(parsed_data.get("time_limit_minutes") or 120)
        parsed_data["total_marks"] = float(parsed_data.get("total_marks") or (len(valid_questions) * 2.0))

        print(f"[SUCCESS] Extracted {len(valid_questions)} questions successfully.\n")
        return parsed_data

    except Exception as e:
        print("\n" + "="*50)
        print("[SERVER ERROR TRACEBACK]")
        traceback.print_exc()
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if uploaded_file:
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception:
                pass
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# ----------------- Admin Exam Management -----------------

@app.post("/api/exams")
async def create_exam(req: SaveExamRequest):
    """Save an extracted or newly created exam with admin credentials"""
    if not req.admin_name.strip() or not req.admin_passcode.strip():
        raise HTTPException(status_code=400, detail="Admin name and passcode are required.")
    if not req.questions:
        raise HTTPException(status_code=400, detail="At least one question is required.")
        
    try:
        q_dicts = [q.model_dump() for q in req.questions]
        res = database.save_new_exam(
            admin_name=req.admin_name,
            admin_passcode=req.admin_passcode,
            title=req.title,
            time_limit_minutes=req.time_limit_minutes,
            total_marks=req.total_marks,
            questions=q_dicts
        )
        return {"status": "success", "exam": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/exams/{exam_id}")
async def update_exam(exam_id: str, req: UpdateExamRequest):
    """Update exam questions, answer keys, time limit, or title"""
    try:
        q_dicts = [q.model_dump() for q in req.questions]
        res = database.update_exam(
            exam_id=exam_id,
            admin_name=req.admin_name,
            admin_passcode=req.admin_passcode,
            title=req.title,
            time_limit_minutes=req.time_limit_minutes,
            total_marks=req.total_marks,
            questions=q_dicts
        )
        return {"status": "success", "exam": res}
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/login")
async def admin_login(req: AdminLoginRequest):
    """Log in as admin to retrieve managed exams and dashboard metrics"""
    if not req.admin_name.strip() or not req.admin_passcode.strip():
        raise HTTPException(status_code=400, detail="Admin name and passcode are required.")
    
    exams = database.get_admin_exams(req.admin_name, req.admin_passcode)
    return {
        "status": "success",
        "admin_name": req.admin_name,
        "exams": exams
    }

@app.get("/api/admin/exams")
async def get_admin_exams(admin_name: str = Query(...), admin_passcode: str = Query(...)):
    """Fetch all exams for this admin"""
    exams = database.get_admin_exams(admin_name, admin_passcode)
    return {"exams": exams}

@app.get("/api/admin/exams/{exam_id}")
async def get_admin_exam_details(exam_id: str, admin_name: str = Query(...), admin_passcode: str = Query(...)):
    """Fetch complete exam details, questions with answer keys, and student participant submissions"""
    try:
        details = database.get_exam_details_for_admin(exam_id, admin_name, admin_passcode)
        return {"status": "success", "exam": details}
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/exams/{exam_id}/export-csv")
async def export_exam_report(exam_id: str, admin_name: str = Query(...), admin_passcode: str = Query(...)):
    """Download participant summary marks report as CSV"""
    try:
        csv_data = database.export_exam_csv(exam_id, admin_name, admin_passcode)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=exam_{exam_id}_summary_report.csv"
            }
        )
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Student / Participant Flow -----------------

@app.get("/api/exams/access/{access_code}")
async def get_exam_by_access_code(access_code: str):
    """Retrieve exam paper booklet for student using their access code (answers stripped for integrity)"""
    try:
        exam = database.get_exam_for_student(access_code)
        return {"status": "success", "exam": exam}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/exams/{exam_id}/submit")
async def submit_exam(exam_id: str, req: SubmitExamRequest):
    """Submit student answers, grade them against the answer key, and record in DB"""
    if not req.student_name.strip():
        raise HTTPException(status_code=400, detail="Student name is required.")
        
    try:
        result = database.submit_student_exam(
            exam_id=exam_id,
            student_name=req.student_name,
            student_id=req.student_id,
            answers=req.answers,
            time_taken_seconds=req.time_taken_seconds
        )
        return {"status": "success", "result": result}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)