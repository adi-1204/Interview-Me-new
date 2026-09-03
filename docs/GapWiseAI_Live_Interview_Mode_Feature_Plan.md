# GapWise AI — Live Interview Mode: Feature Plan

**Status:** Draft v1.0
**Last Updated:** August 29, 2026

---

## 1. What This Feature Adds

GapWise AI currently generates a **one-shot interview report**: a user submits a resume and a job description, and Gemini returns a complete report in a single response — match score, predicted technical/behavioral questions with intended answers, skill gaps, and a preparation plan. This is fast and useful for prep, but it's not an actual interview experience — the user reads questions, they don't answer them.

**Live Interview Mode** adds a second, complementary product surface: a real-time, one-question-at-a-time interview simulation where the user answers out loud on camera, gets each answer analyzed, and receives a full performance report at the end — scored on content, communication (speech delivery), and body language, with a STAR-method breakdown for behavioral questions.

The existing one-shot report generator is not being removed or changed. This is new functionality added alongside it, sharing the existing auth system, resume upload/parsing pipeline, and Gemini integration conventions.

## 2. Current System — What Already Exists and Is Being Reused

Verified directly from the codebase, not assumed:

| Piece | Location | Reuse plan for Live Interview Mode |
|---|---|---|
| Express app, CORS, error handling | `Backend/src/app.js` | New route groups mounted alongside existing `/api/auth` and `/api/interview` |
| JWT auth (register/login/logout/get-me), token blacklist | `Backend/src/controllers/auth.controller.js`, `auth.middleware.js`, `blacklist.model.js` | Used as-is — no new auth system needed |
| User model | `Backend/src/models/user.model.js` | Reused; may need new fields later if user-level preferences are added |
| Resume upload (Multer) | `Backend/src/middlewares/file.middleware.js` | Reused for resume upload in the new flow; a *second*, separate upload path is needed for interview audio/video (larger files, different validation — see Section 4) |
| PDF text extraction (`pdf-parse`) | Used inside `interview.controller.js`'s existing resume-handling logic | Extracted into a shared, reusable function (see Ticket 1) rather than duplicated |
| Gemini integration pattern | `Backend/src/services/ai.service.js` — retry-with-backoff (`withAiRetry`), transient-error detection, Zod schema enforcement via `zod-to-json-schema` | This exact pattern is reused for every new Gemini call in Live Interview Mode — question generation, STAR evaluation, scoring — rather than reinventing error handling |
| RAG pipeline (LangChain + Pinecone) | `Backend/src/services/rag.service.js` | Not required for Live Interview Mode's core loop, but the same resume-chunking/embedding approach could optionally be reused later to make follow-up questions more resume-aware — flagged as a future enhancement, not required for v1 |
| React + Vite frontend, SASS styling | `Frontend/src/` | The existing frontend gets new pages for the interview flow; new pages should follow the existing project structure (`features/<name>/pages`, `features/<name>/services`, `features/<name>/style`) matching how `features/interview/` is already organized for the one-shot report flow |

## 3. New Data Models Required

The existing `InterviewReport` model represents a single generated report from one Gemini call — it has no concept of an ongoing, multi-turn session. Live Interview Mode needs its own models:

**`InterviewSession`** (new)
```
user: ObjectId (ref: users)
resume: ObjectId (ref: Resume, see below)
targetRole: String
targetDomain: String
companyStyle: String
status: String (enum: "in_progress", "complete")
turns: [SessionTurn] (embedded)
overallScore: Number
dimensionScores: { content: Number, communication: Number, bodyLanguage: Number | null }
improvedAnswerSuggestion: String
weakTopics: [String]
createdAt, updatedAt: timestamps
```

**`SessionTurn`** (embedded subdocument on `InterviewSession`)
```
questionText: String
questionType: String (enum: "behavioral", "technical")
recordingUrl: String
transcript: String
contentScore: Number
communicationScore: Number
bodyLanguageScore: Number | null
starBreakdown: { situation, task, action, result: Boolean } | null
status: String (enum: "pending", "processing", "complete", "failed")
```

**`Resume`** (new — separate from the ad-hoc resume handling inside `interview.controller.js`, since Live Interview Mode needs to reference a persisted, structured resume across a whole session rather than a single request)
```
user: ObjectId (ref: users)
rawText: String
structuredData: { skills: [String], projects: [...], experience: [...] } | null
targetRole, targetDomain, companyStyle: String
createdAt, updatedAt: timestamps
```

## 4. Open Decisions to Make Before Building Analysis Features

These aren't technical unknowns so much as choices with real tradeoffs — flagging them explicitly so they're made on purpose:

**4.1 Recording storage.** Resume PDFs are small; interview audio/video is not. Options: local disk (simplest, fine for development, not for production), or a cloud object store (S3-compatible, Cloudinary, etc.). Decide before building the recording upload endpoint (Ticket 6).

**4.2 Speech transcription and body-language analysis provider.** Nothing in the current stack does either of these. Two real paths:
- **Stay in Node**: call a hosted speech-to-text API from Express for transcription; use a hosted or lightweight in-Node approach for body-language cues. Simpler deployment, weaker computer-vision ecosystem.
- **Add a small Python microservice** for transcription + body-language analysis, called over HTTP from Express, added to `docker-compose.yml` as its own service. More moving parts, stronger vision/ML ecosystem.

This decision should be made before Ticket 8 (Real Speech Transcription) and Ticket 10 (Body Language Analysis) — those tickets are written with a placeholder for "the chosen provider" rather than assuming one.

## 5. Build Plan

Organized in phases, ordered by dependency. Work top to bottom; items listed together on one line have no dependency on each other.

### Phase 1 — Resume Foundation for Sessions

**Ticket 1 — Standalone Resume Upload & Parsing Route**
Extract the existing PDF-parsing logic out of `interview.controller.js` into a shared `resumeService.js` function `extractResumeText(fileBuffer)`. Add a new route `POST /api/resumes` (separate from the existing `/api/interview/` route, which stays as-is for the one-shot flow) accepting a resume PDF plus `targetRole`, `targetDomain`, `companyStyle`, creating a new `Resume` document. Handle the existing near-empty-extraction edge case (scanned PDFs) the same way it's already handled, returning a clear 400.

**Ticket 2 — LLM-Based Resume Structuring**
Add `structureResume(rawText)` to `ai.service.js`, following the existing `withAiRetry` + Zod pattern, returning `{ skills, projects, experience }`. Add `POST /api/resumes/:id/structure` to run this and save the result.

**Ticket 3 — Resume Review UI**
New frontend page under `features/session/pages/ResumeReview.jsx` (or similar, matching existing naming conventions) showing the structured resume as editable fields, with a save action that PATCHes `/api/resumes/:id`.

### Phase 2 — Live Interview Core Loop

**Ticket 4 — Interview Session Model & Creation Endpoint**
Create the `InterviewSession` and embedded `SessionTurn` schema described in Section 3. Add `POST /api/sessions` accepting a `resumeId`, generating a first question via Gemini (new function in `ai.service.js`: given resume structured data + target role/domain/company style, generate one question with `questionType`, Zod-enforced, using `withAiRetry`), creating the session with this as the first turn.

**Ticket 5 — Webcam & Mic Recording UI**
New frontend page for the live interview screen using `getUserMedia` + `MediaRecorder` to capture audio/video. Handle permission denial gracefully — offer an audio-only fallback rather than a broken UI.

**Ticket 6 — Recording Upload & Processing Pipeline**
`POST /api/sessions/:id/turns/:turnIndex/response` accepting the recorded Blob, storing it per the Section 4.1 decision, and calling a stub `analyzeResponse(recordingUrl)` function (hardcoded placeholder scores for now) so the full pipeline can be tested end-to-end before real analysis exists.

**Ticket 7 — Response Status Polling & Adaptive Follow-Ups**
`GET /api/sessions/:id/turns/:turnIndex/status` — once a turn is complete, generates the next question via Gemini, considering the previous turn's transcript/scores to decide whether to ask a follow-up or move on. Marks the session `complete` after a fixed number of questions.

### Phase 3 — Real Analysis (Blocked on Section 4.2 Decision)

**Ticket 8 — Real Speech Transcription**
Replace the stub transcript with a real call to the chosen provider from Section 4.2.

**Ticket 9 — Speech Delivery Analysis**
Compute WPM and filler-word density from the real transcript/audio to produce a real `communicationScore`.

**Ticket 10 — Body Language Analysis**
Real eye-contact/posture analysis from video, per the Section 4.2 decision. Must return `null` (not a fabricated score) when no video track exists (audio-only fallback).

**Ticket 11 — STAR Method Evaluation**
New `evaluateStarMethod(transcript)` in `ai.service.js`, Zod-enforced `{ situation, task, action, result }` booleans, called only for `questionType: "behavioral"` turns.

### Phase 4 — Scoring & Reporting

**Ticket 12 — Score Aggregation**
Once a session completes, average each turn's scores (skipping nulls, not treating them as zero) into `dimensionScores` and an `overallScore`.

**Ticket 13 — Improved Answer Suggestion & Weak Topics**
Two Gemini calls: one identifying the lowest-scoring turn and suggesting a specific improvement; one scanning all turns for 2-3 recurring weak topics. Both Zod-enforced, both using `withAiRetry`.

**Ticket 14 — Report Endpoint & Dashboard**
`GET /api/sessions/:id/report` returning the full session. New frontend report page with a radar chart (dimension scores), per-question breakdown, STAR badges, improved-answer card, weak-topics list.

**Ticket 15 — Session History**
`GET /api/sessions` returning the user's own completed sessions, most recent first. New frontend list page with a progress trend line once 2+ sessions exist.

### Phase 5 — Hardening

**Ticket 16 — Account & Data Deletion**
Extend account deletion (if not already present) to also remove `Resume` and `InterviewSession` documents and their associated recording files.

**Ticket 17 — Gemini Resilience Audit**
Confirm every new Gemini call added in Phases 1-4 is wrapped in `withAiRetry`, and add a hardcoded fallback question pool for when question generation exhausts retries, so a candidate is never stuck mid-session.

## 6. New API Endpoints Summary

Following the existing README's endpoint table convention:

### Resume Routes (new)
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/resumes | Upload and parse a resume for session use |
| POST | /api/resumes/:id/structure | Generate structured skills/projects/experience |
| PATCH | /api/resumes/:id | Save user edits to structured resume data |

### Session Routes (new)
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/sessions | Create a session and generate the first question |
| POST | /api/sessions/:id/turns/:turnIndex/response | Upload a recorded answer |
| GET | /api/sessions/:id/turns/:turnIndex/status | Poll processing status; get next question |
| GET | /api/sessions/:id/report | Get the full completed session report |
| GET | /api/sessions | List the user's own sessions |

Existing `/api/auth/*` and `/api/interview/*` routes are unchanged.

## 7. Environment Variables to Add

Existing `env.example` variables (Mongo, JWT, Gemini, Pinecone) are unchanged. New additions once Section 4 decisions are made:

```
RECORDING_STORAGE_PROVIDER=<local|s3|cloudinary>
SPEECH_TO_TEXT_PROVIDER=<tbd>
VISION_ANALYSIS_SERVICE_URL=<tbd, only if using a separate microservice>
```
