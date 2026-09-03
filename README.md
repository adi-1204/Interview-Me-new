# InterviewMe 🎯

> **AI-Powered Interactive Interview Preparation Platform** — upload your resume, practice live interactive webcam & audio mock interviews with real-time AI speech transcription, body language analysis, STAR framework feedback, and comprehensive skill gap reports.

![InterviewMe](https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/Frontend-React%2019%20+%20Vite-61DAFB?style=for-the-badge&logo=react)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge&logo=google)
![Docker](https://img.shields.io/badge/Containerized-Docker-2496ED?style=for-the-badge&logo=docker)
![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions)

---

## ✨ Features

- 🔐 **JWT Authentication & Security System**
- 📄 **Standalone Resume Parsing & LLM Structuring** (Skills, Projects, Work Experience)
- 🎙️ **Live Interactive Webcam & Mic Interview Mode**
- 🤖 **Multimodal AI Speech Transcription** (Gemini AI audio/video transcription with format fallback)
- 🗣️ **Speech Delivery Analytics** (WPM calculation, filler word density, communication score)
- 👁️ **Visual Body Language Analysis** (Eye contact tracking, posture alignment, visual confidence)
- ⭐ **STAR Framework Behavioral Evaluator** (Situation, Task, Action, Result breakdown)
- 🎯 **Adaptive Follow-Up Question Engine** (Probes candidate weaknesses dynamically based on previous turns)
- ⏹️ **Instant "End Interview" Support** (Instant report generation for partial or full sessions)
- 📊 **Detailed Session Analytics Dashboard** (Dimension scores, radar breakdown, AI answer improvements, weak topics)
- 🧠 **RAG-Powered Skill Gap Analysis & Job Match Scoring**
- 📥 **ATS-Friendly Resume PDF Generator** (Chromium/Puppeteer local fallback)
- 🧪 **Comprehensive Automated Test Suite** (Jest + Supertest)
- 🐳 **Docker & CI/CD Ready**

---

## 🛠️ Tech Stack

### Backend

| Technology | Purpose |
| --- | --- |
| Node.js + Express | REST API Server |
| MongoDB + Mongoose | Database & Session Persistence |
| JWT + bcryptjs | User Authentication & Authorization |
| Google Gemini AI (`@google/genai`) | Question generation, multimodal speech transcription, body language, STAR evaluation |
| Local RAG Service | Resume chunking, embedding, vector retrieval |
| Puppeteer Core + Chromium | HTML to PDF conversion |
| Multer | Audio/video recording & resume file upload handling |
| pdf-parse | PDF text extraction |
| Zod + zod-to-json-schema | Strict AI output schema enforcement |
| Jest + Supertest | Unit & Integration testing |

### Frontend

| Technology | Purpose |
| --- | --- |
| React 19 + Vite | UI Framework & Fast Bundling |
| React Router v7 | Single Page Application Routing |
| Axios | HTTP Client |
| SCSS | Modular SASS styling |
| WebRTC / MediaRecorder API | Browser webcam & audio stream recording |

---

## 🚀 Local Development Setup

### Prerequisites

- Node.js >= 18
- MongoDB (Local instance or MongoDB Atlas URI)
- Google Gemini API Key (`GOOGLE_GENAI_API_KEY`)
- Pinecone Account & API Key (for RAG features)

---

### 1. Clone Repository

```bash
git clone https://github.com/Akshay4754/GapWiseAI.git
cd GapWiseAI
```

---

### 2. Backend Setup

```bash
cd Backend
npm install
```

Create `.env` inside `Backend/`:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_GENAI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=gapwise-ai-rag-google
GOOGLE_EMBEDDING_MODEL=gemini-embedding-001
GOOGLE_EMBEDDING_DIMENSIONS=768
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5174
```

Start Backend:

```bash
npm run dev
# or
npm start
```

---

### 3. Frontend Setup

```bash
cd ../Frontend
npm install
```

Create `.env` inside `Frontend/`:

```env
VITE_API_URL=http://localhost:3000
```

Start Frontend:

```bash
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## 🔑 API Endpoints

### 🔐 Auth Routes

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Register new user account |
| POST | `/api/auth/login` | Login user & issue JWT token |
| GET | `/api/auth/logout` | Logout user |
| GET | `/api/auth/get-me` | Get current authenticated user |

---

### 📄 Resume Routes

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/resumes` | Upload resume PDF & extract text |
| POST | `/api/resumes/:id/structure` | Run LLM structuring on resume (skills, projects, experience) |
| PATCH | `/api/resumes/:id` | Update structured resume data |

---

### 🎙️ Live Interview Session Routes

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/sessions` | Create live interview session & generate Question #1 |
| GET | `/api/sessions/:id` | Fetch interview session state & turns |
| POST | `/api/sessions/:id/turns/:turnIndex/response` | Upload recorded answer Blob & trigger AI analysis |
| GET | `/api/sessions/:id/turns/:turnIndex/status` | Poll turn analysis status & pre-generate adaptive follow-up |
| POST | `/api/sessions/:id/end` | Manually end interview & compute session report |
| GET | `/api/sessions/:id/report` | Fetch aggregated session report & actionable feedback |

---

### 📑 One-Shot Interview & RAG Routes

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/interview/` | Generate one-shot interview report |
| GET | `/api/interview/` | Fetch user interview reports |
| GET | `/api/interview/report/:id` | Fetch single report details |
| POST | `/api/interview/resume/pdf/:id` | Generate & download ATS resume PDF |

---

## 🧪 Running Automated Tests

Run all unit & integration test suites from the `Backend/` directory:

```bash
cd Backend
npm test
```

Test suites include:
- `tests/api.test.js` — Auth & RAG endpoints
- `tests/resume.test.js` — Resume upload, parsing & structuring
- `tests/session.test.js` — Session creation, turns, report & manual end routes
- `tests/interviewAnalysis.test.js` — Speech delivery, body language & STAR evaluation services

---

## 📁 Project Structure

```bash
GapWiseAI/
├── docs/
│   ├── GapWiseAI_Live_Interview_Mode_Feature_Plan.md
│   └── GapWiseAI_Live_Interview_Mode_Tickets.md
├── docker-compose.yml
│
├── Backend/
│   ├── server.js                       # Express server entry point
│   ├── tests/                          # Jest + Supertest test suites
│   └── src/
│       ├── app.js                      # App config & route registration
│       ├── config/                     # Database connection
│       ├── controllers/                # Handlers (session, resume, auth, interview)
│       ├── middlewares/                # Auth & Multer upload middleware
│       ├── models/                     # Schemas (user, resume, session, interview)
│       ├── routes/                     # API routers
│       └── services/
│           ├── ai.service.js           # Gemini API, structuring & question generation
│           ├── interviewAnalysis.service.js # Multimodal transcription, WPM, STAR & body language
│           └── rag.service.js          # RAG embedding & retrieval pipeline
│
└── Frontend/
    ├── src/
    │   ├── app.routes.jsx              # React router definitions
    │   └── features/
    │       ├── auth/                   # Authentication feature components
    │       ├── interview/              # One-shot interview & report view
    │       └── session/                # Live Interview Practice Mode
    │           ├── components/         # MediaRecorderView webcam recorder
    │           ├── pages/              # ResumeReview, LiveInterview, Processing, SessionReport
    │           ├── services/           # Session API client
    │           └── style/              # SASS styling stylesheets
    └── vite.config.js
```

---

## 📄 License

MIT © InterviewMe Team
