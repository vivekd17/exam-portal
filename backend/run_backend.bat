@echo off
title Exam Engine Backend
echo ========================================================
echo Starting Exam Engine Backend (FastAPI + SQLite + Gemini)
echo ========================================================
cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found at backend\venv!
    pause
    exit /b 1
)

echo Using Python from virtual environment: backend\venv
venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
