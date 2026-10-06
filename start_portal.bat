@echo off
title Launch Exam Portal Pro
echo ======================================================================
echo           Starting PrepPortal Pro • CBT Engine v2.0
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/2] Launching Backend API Server (FastAPI on http://localhost:8000)...
start "Exam Engine Backend" cmd /k "cd backend && run_backend.bat"

timeout /t 2 /nobreak >nul

echo [2/2] Launching Frontend Development Server (Vite on http://localhost:5173)...
start "Exam Engine Frontend" cmd /k "cd frontend && run_frontend.bat"

timeout /t 3 /nobreak >nul

echo.
echo Opening browser to http://localhost:5173...
start http://localhost:5173

echo.
echo ======================================================================
echo Both servers are running!
echo - Student / Admin Portal: http://localhost:5173
echo - Backend API Docs:       http://localhost:8000/docs
echo ======================================================================
pause
