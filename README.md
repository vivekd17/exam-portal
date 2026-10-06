# PrepPortal Pro • CBT Engine v2.0

An intelligent, modern Computer Based Testing (CBT) and Examination Portal built with FastAPI (Python) and React + Tailwind CSS (Vite), featuring AI-powered exam generation and real-time proctoring features.

---

## 🚀 Features

- **Candidate Exam Interface**: Timed tests, question navigation palette, instant review, LaTeX math rendering, and submission workflows.
- **Admin & Faculty Dashboard**: Exam creation, question bank management, dynamic exam scheduling, and student analytics.
- **AI-Powered Capabilities**: Integration with Google Gemini for automated question generation and detailed step-by-step explanations.
- **Robust Backend**: FastAPI with SQLite/SQLAlchemy for high performance, automatic OpenAPI documentation (`/docs`), and asynchronous endpoints.
- **Responsive & Modern UI**: Built with React, Vite, and Tailwind CSS for speed, accessibility, and sleek dark/light mode ergonomics.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, Google Generative AI (Gemini)
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, KaTeX
- **Database**: SQLite (local)

---

## 📦 Getting Started

### Prerequisites

- [Python 3.10+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/)
- Git

### Quick Start (Windows)

Simply double-click `start_portal.bat` in the root folder, or run:

```cmd
start_portal.bat
```

This starts both the FastAPI backend and the Vite frontend dev server and automatically opens your browser.

---

### Manual Setup

#### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env
# Edit .env and insert your GEMINI_API_KEY

# Run backend server
uvicorn main:app --reload --port 8000
```

Backend will be running at `http://localhost:8000` (Docs: `http://localhost:8000/docs`).

#### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be running at `http://localhost:5173`.

---

## 📄 License

This project is licensed under the MIT License.
