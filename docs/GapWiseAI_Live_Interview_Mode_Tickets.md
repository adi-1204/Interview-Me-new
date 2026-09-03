# GapWise AI — Live Interview Mode: Ticket List

**Status:** Draft v1.0
**Last Updated:** August 29, 2026
**Companion doc:** `GapWiseAI_Live_Interview_Mode_Feature_Plan.md` — read that first for the overall shape of this feature, the new data models, and the two open decisions in its Section 4 (recording storage, transcription/vision provider) that block Phase 3 below.

**How to use this document:** Each ticket is self-contained and can be pasted directly into an AI coding tool as a build prompt. Every prompt assumes only the existing GapWise AI repository (Node.js/Express backend, MongoDB/Mongoose, JWT auth, Google Gemini via `@google/genai` with Zod schema enforcement, React + Vite frontend). Work through phases top to bottom; within a phase, tickets are already ordered by dependency.

---

## Phase 1 — Resume Foundation for Sessions

### TICKET 1 — Standalone Resume Upload & Parsing Route
**Priority:** Must-have
**Dependencies:** None

**Description:** The existing `POST /api/interview/` route parses an uploaded resume PDF as part of generating a one-shot report, coupling resume parsing to that flow. Live Interview Mode needs resume parsing as its own standalone step, decoupled from report generation, so a resume can be uploaded once and reused across an entire interview session.

**Build prompt:**
> In the backend, extract the PDF text-extraction logic currently used inside the interview controller into a shared function `extractResumeText(fileBuffer)` in a new file `src/services/resumeService.js`. Add a new route `POST /api/resumes` that accepts a multipart form with a `resume` PDF file field plus `targetRole`, `targetDomain`, `companyStyle` string fields, reusing the existing Multer configuration from `src/middlewares/file.middleware.js`. Create a new Mongoose model `Resume` in `src/models/resume.model.js` with fields `user` (ObjectId ref to `users`), `rawText` (String), `targetRole`, `targetDomain`, `companyStyle` (String), with `{ timestamps: true }`. On successful extraction, save a new `Resume` document and return its `_id` and the length of the extracted text (not the full text) in the response. If extraction returns near-empty text (e.g. a scanned image-only PDF with no real text layer), return a 400 with a clear message rather than saving a useless document — check how the existing interview controller already handles this case and mirror that behavior.

**Acceptance Criteria:**
- Uploading a normal text-based resume PDF creates a `Resume` document with non-empty `rawText`.
- Uploading a scanned/image-only PDF returns a clear 400 error, not a crash or an empty success.
- The route requires authentication via the existing `authMiddleware.authUser`.

---

### TICKET 2 — LLM-Based Resume Structuring
**Priority:** Must-have
**Dependencies:** Ticket 1

**Description:** Turn a resume's raw extracted text into structured skills/projects/experience data, so later question-generation can reference specific things the candidate has actually done.

**Build prompt:**
> In `src/services/ai.service.js`, add a new function `structureResume(rawText)` that calls Gemini with a Zod schema enforcing `{ skills: string[], projects: { name: string, description: string, technologies: string }[], experience: { role: string, company: string, description: string }[] }`. Follow the exact same pattern already used elsewhere in this file for schema-enforced Gemini calls (`zodToJsonSchema`, the existing `withAiRetry` wrapper for retry-with-backoff on transient errors). Add a route `POST /api/resumes/:id/structure` that loads the `Resume` document by id, calls `structureResume` on its `rawText`, and saves the result to a new `structuredData` field on the document. Return the structured data in the response.

**Acceptance Criteria:**
- Given a real resume's raw text, the returned structured data has non-empty `skills` and at least one of `projects`/`experience`.
- If Gemini returns data that fails Zod validation, the route returns a clear error rather than saving invalid data to the database.

---

### TICKET 3 — Resume Review Frontend Page
**Priority:** Must-have
**Dependencies:** Ticket 2

**Description:** A page where the user reviews and corrects the auto-extracted resume data before starting a session.

**Build prompt:**
> In the frontend, create a new feature folder `src/features/session/` following the same internal structure as the existing `src/features/interview/` folder (a `pages/` folder, a `services/` folder for API calls, a `style/` folder for SASS). Add `src/features/session/pages/ResumeReview.jsx` that fetches a resume's structured data (call `POST /api/resumes/:id/structure` if not already structured, or fetch existing `structuredData` if it is — decide based on whether Ticket 2's route is meant to be idempotent, and make it return existing `structuredData` on a second call rather than re-running Gemini unnecessarily), and renders editable lists for skills, projects, and experience, matching the visual style already established in `src/features/interview/pages/Interview.jsx` and its SCSS file. Add a "Confirm and Continue" action that PATCHes any edits to `/api/resumes/:id` before navigating to the next step (the interview session creation flow, built in Phase 2).

**Acceptance Criteria:**
- Structured resume data renders in editable fields.
- Edits persist to MongoDB after clicking "Confirm and Continue," verifiable by re-fetching the resume.
- Visual style is consistent with the existing `interview` feature's pages, not a mismatched one-off design.

---

## Phase 2 — Live Interview Core Loop

### TICKET 4 — Interview Session Model & Creation Endpoint
**Priority:** Must-have
**Dependencies:** Ticket 3

**Description:** Create the data model for a live, multi-turn interview session. This has no equivalent in the existing `InterviewReport` model, which represents a single generated report from one Gemini call, not an ongoing session.

**Build prompt:**
> Create a new Mongoose model `InterviewSession` in `src/models/interviewSession.model.js` with: `user` (ObjectId ref `users`), `resume` (ObjectId ref `Resume`), `targetRole`, `targetDomain`, `companyStyle` (String), `status` (String enum `"in_progress"`/`"complete"`), `turns` (array of embedded subdocuments — see below), `overallScore` (Number), `dimensionScores` (object: `content`, `communication`, `bodyLanguage`, each Number or null), `improvedAnswerSuggestion` (String), `weakTopics` ([String]), `{ timestamps: true }`. Each embedded turn subdocument needs: `questionText` (String), `questionType` (String enum `"behavioral"`/`"technical"`), `recordingUrl` (String), `transcript` (String), `contentScore`, `communicationScore`, `bodyLanguageScore` (Number or null), `starBreakdown` (object with `situation`/`task`/`action`/`result` booleans, or null), `status` (String enum `"pending"`/`"processing"`/`"complete"`/`"failed"`). Add a route `POST /api/sessions` accepting `{ resumeId }`, loading that resume's `structuredData`, and generating a first question via a new `generateInterviewQuestion(structuredData, targetRole, targetDomain, companyStyle, previousTurns)` function in `ai.service.js` (Zod schema: `{ questionText: string, questionType: "behavioral" | "technical" }`, using the existing `withAiRetry` pattern; `previousTurns` can be an empty array for this first call). Create the `InterviewSession` document with `status: "in_progress"` and this question as the first turn (`status: "pending"`). Return the session id and the first question.

**Acceptance Criteria:**
- Creating a session with a valid `resumeId` returns a session id and a contextually relevant first question (referencing something specific from the resume's structured data, not a generic placeholder).
- The created document has `status: "in_progress"` and exactly one turn with `status: "pending"`.
- An invalid or missing `resumeId` returns a clear 400 error.

---

### TICKET 5 — Webcam & Mic Recording Frontend Page
**Priority:** Must-have
**Dependencies:** None (only needs the existing auth system — can be built in parallel with Tickets 1-4)

**Description:** The live interview screen itself — question display plus real browser-based audio/video recording.

**Build prompt:**
> Create `src/features/session/pages/LiveInterview.jsx`. On mount, display the current question (passed via route state or fetched from the session). Use `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` to request camera/mic access, rendering the live stream in a muted, autoplaying `<video>` element (muted to avoid audio feedback from the user's own mic). Use `MediaRecorder` to record the stream once permission is granted, starting automatically when the question loads. Add a "Submit Answer" button that stops the recorder and produces a `Blob`. Handle permission denial gracefully: if `getUserMedia` rejects, show a clear message with an option to continue in audio-only mode (retry with `{ audio: true }` only) or try again — never leave the user on a frozen or blank screen. Style consistently with the existing `interview` feature's SCSS conventions, but this screen should read as more focused/immersive (dark background, minimal chrome) than the existing report-viewing pages, since a user is on camera here.

**Acceptance Criteria:**
- Camera/mic permission prompt appears on load; granting it shows a live video preview.
- Clicking "Submit Answer" produces a Blob containing the recording.
- Denying permission shows a clear fallback UI, not a broken or frozen page.

---

### TICKET 6 — Recording Upload & Processing Pipeline
**Priority:** Must-have
**Dependencies:** Ticket 4, Ticket 5

**Description:** Wire the recorded Blob to the backend, and build the pipeline that receives it and (for now) stubs out analysis, so the full loop can be tested end-to-end before real transcription/vision analysis exists. **Where recordings are stored (local disk vs. cloud) should be decided per the companion Feature Plan doc's Section 4.1 before starting this ticket.**

**Build prompt:**
> Add a route `POST /api/sessions/:id/turns/:turnIndex/response` accepting a multipart upload of the recorded Blob. Store the file using [local disk via Multer, following the existing pattern in `file.middleware.js` / a cloud storage provider — fill in based on the Section 4.1 decision], saving the resulting URL/path to that turn's `recordingUrl`, and set the turn's `status` to `"processing"`. Create a new file `src/services/interviewAnalysis.service.js` with a stub function `analyzeResponse(recordingUrl)` that currently returns hardcoded placeholder values: `{ transcript: "STUB - transcription not yet implemented", contentScore: 70, communicationScore: 70, bodyLanguageScore: 70 }`. Call this stub, save its result onto the turn, and set the turn's `status` to `"complete"`. On the frontend, wire `LiveInterview.jsx`'s "Submit Answer" button to upload the Blob to this route, then navigate to a processing screen (built in Ticket 7).

**Acceptance Criteria:**
- Submitting a recording successfully uploads it and moves the turn's status from `pending` → `processing` → `complete`.
- The turn document has (stubbed) transcript and scores after processing.
- The frontend navigates away immediately after upload, not after analysis finishes (analysis is asynchronous from the client's perspective).

---

### TICKET 7 — Response Status Polling & Adaptive Follow-Up Questions
**Priority:** Must-have
**Dependencies:** Ticket 6

**Description:** A processing screen that polls for the next question, and backend logic that decides the next question adaptively based on the previous answer.

**Build prompt:**
> Add a route `GET /api/sessions/:id/turns/:turnIndex/status` returning `{ status, nextQuestion? }`. If the polled turn is `"complete"` and the session hasn't reached its question limit (define a fixed count, e.g. 6, stored on the session or as a constant), call `generateInterviewQuestion` again (from Ticket 4), this time passing the actual `previousTurns` array so Gemini can decide whether to ask a natural follow-up on the same topic or move to a new one — this is the adaptive part. Append the new question as a new turn (`status: "pending"`) and return it as `nextQuestion`. If the question limit is reached, set the session's `status` to `"complete"` and return `{ status: "session_complete" }` instead, without generating a new question. Create `src/features/session/pages/Processing.jsx` with a simple loading state that polls this endpoint every 2 seconds, navigating to `LiveInterview.jsx` with the new question once one arrives, or to the report page (built in Phase 4) if the session is complete. Ensure polling stops once a terminal state is reached — no polling after navigation away.

**Acceptance Criteria:**
- After submitting an answer, the processing screen automatically advances to the next question once it's ready.
- After the final question, the processing screen navigates to the report instead of asking another question.
- No runaway polling continues after the terminal state is reached.

---

## Phase 3 — Real Analysis (Blocked on Feature Plan Section 4.2 Decision)

### TICKET 8 — Real Speech Transcription
**Priority:** Must-have
**Dependencies:** Ticket 6, plus the provider decision from the companion Feature Plan doc's Section 4.2

**Description:** Replace the stub transcript with a real one.

**Build prompt:**
> [Fill in the specific provider call once Section 4.2's decision is made — e.g., "Call [provider]'s speech-to-text API with the audio at `recordingUrl`" or "POST the recording to the Python microservice at `VISION_ANALYSIS_SERVICE_URL` and use its `transcript` field from the response."] In `src/services/interviewAnalysis.service.js`, replace the hardcoded transcript string in `analyzeResponse` with this real call, keeping the function's existing signature and return shape so Ticket 6's calling code in the route handler doesn't need to change.

**Acceptance Criteria:**
- A real recorded answer produces a transcript that reasonably matches what was said.
- Transcription failures (bad audio, provider timeout) are caught and result in the turn's `status` becoming `"failed"` rather than the request crashing — follow the retry pattern already established by `withAiRetry` in `ai.service.js` for consistency, even though this call isn't to Gemini.

---

### TICKET 9 — Speech Delivery Analysis
**Priority:** Must-have
**Dependencies:** Ticket 8

**Description:** Derive a real communication score from words-per-minute and filler-word usage.

**Build prompt:**
> In `src/services/interviewAnalysis.service.js`, add `analyzeSpeechDelivery(transcript, audioDurationSeconds)` that computes words-per-minute from the transcript and duration, counts common filler words ("um", "uh", "like", "you know"), and derives a `communicationScore` from both signals using a simple rubric you define (e.g., penalize WPM far outside a 120-160 comfortable range, penalize high filler-word density per 100 words). Wire this into `analyzeResponse`, replacing the hardcoded `communicationScore`.

**Acceptance Criteria:**
- A fast, filler-heavy test transcript produces a visibly lower score than a measured, filler-light one when both are run through the function directly.

---

### TICKET 10 — Body Language Analysis
**Priority:** Must-have
**Dependencies:** Ticket 6, plus the provider decision from the companion Feature Plan doc's Section 4.2

**Description:** Derive a real body-language score from the recorded video.

**Build prompt:**
> [Fill in the specific approach once Section 4.2's decision is made.] Replace the hardcoded `bodyLanguageScore` in `analyzeResponse` with a real score derived from eye-contact percentage and posture stability across the recording. If the recording has no video track (the audio-only fallback path from Ticket 5's permission-denial handling), return `null` for this score rather than a fabricated number — the report page built in Phase 4 should treat `null` as "not available for this session," not as a zero.

**Acceptance Criteria:**
- A test video with a steady, forward-facing speaker scores higher than one where the camera looks away most of the time.
- An audio-only submission correctly returns `null`, not a fabricated score.

---

### TICKET 11 — STAR Method Evaluation
**Priority:** Must-have
**Dependencies:** Ticket 8

**Description:** For behavioral questions, evaluate whether the answer covers Situation, Task, Action, and Result.

**Build prompt:**
> In `src/services/ai.service.js`, add `evaluateStarMethod(transcript)` calling Gemini with a Zod schema `{ situation: boolean, task: boolean, action: boolean, result: boolean }`, asking it to judge whether each STAR component is present in the given answer transcript. Follow the existing retry/schema-enforcement pattern used elsewhere in this file. Wire this into `analyzeResponse`, but only invoke it when the turn's `questionType` is `"behavioral"` — technical-question turns should have `starBreakdown: null`.

**Acceptance Criteria:**
- A well-structured behavioral answer with a clear outcome returns all four fields `true`.
- An answer that rambles without a clear result returns `result: false` while other fields may still be `true`.
- Technical-question turns have `starBreakdown: null`.

---

## Phase 4 — Scoring & Reporting

### TICKET 12 — Score Aggregation
**Priority:** Must-have
**Dependencies:** Ticket 9, Ticket 10, Ticket 11

**Description:** Roll up per-turn scores into session-level dimension scores and an overall score once a session completes.

**Build prompt:**
> Add a function `aggregateSessionScore(sessionId)`, called once a session's `status` becomes `"complete"` (triggered from Ticket 7's completion logic), that averages each turn's `contentScore`, `communicationScore`, and `bodyLanguageScore` — skipping `null` values rather than treating them as zero — to produce the session's `dimensionScores`, and computes an `overallScore` as an average (simple or weighted, your choice) of the three dimensions. Save both to the `InterviewSession` document.

**Acceptance Criteria:**
- A completed session with all turns fully scored has correct dimension averages, spot-checked against manual calculation.
- A session where one turn has `bodyLanguageScore: null` (audio-only fallback) still produces a valid overall score, correctly excluding that null rather than counting it as zero.

---

### TICKET 13 — Improved Answer Suggestion & Weak Topics
**Priority:** Should-have
**Dependencies:** Ticket 12

**Description:** Two small Gemini calls that turn a completed session's data into actionable feedback.

**Build prompt:**
> Add two functions to `ai.service.js`: (1) `suggestImprovedAnswer(question, transcript)` — given the lowest-scoring turn's question and transcript (identify the lowest-scoring turn by combined score in the calling code), returns a Zod-enforced `{ suggestion: string }` under ~100 words with a specific, actionable improvement, not generic advice; (2) `identifyWeakTopics(allTurns)` — given all turns' transcripts and scores in one call, returns a Zod-enforced `{ weakTopics: string[] }` with 2-3 short (under 10 words each) recurring weak areas across the whole session. Both follow the existing `withAiRetry` pattern. Save results to `InterviewSession.improvedAnswerSuggestion` and `InterviewSession.weakTopics`.

**Acceptance Criteria:**
- The improved-answer suggestion references specifics from the actual weak transcript, not a generic tip — verify by reading it against the source answer.
- Given a session with an obvious recurring weakness (e.g., every answer lacks a quantified outcome), that pattern appears in the returned weak topics.

---

### TICKET 14 — Report Endpoint & Frontend Dashboard
**Priority:** Must-have
**Dependencies:** Ticket 12, Ticket 13

**Description:** Expose a completed session as a full report, and build the page that displays it.

**Build prompt:**
> Add a route `GET /api/sessions/:id/report` returning the full `InterviewSession` document — dimension scores, overall score, every turn with its question/transcript/scores/STAR data, the improved-answer suggestion, and weak topics. Create `src/features/session/pages/Report.jsx` fetching this endpoint by session id from the route params, rendering: an overall score headline, a radar chart across the three dimensions (add a charting library if the frontend doesn't already have one — check `package.json` first), a per-question expandable list showing transcript excerpts and scores with STAR badges where applicable, an "Improved Answer" card, and a "Weak Topics to Revise" list. Any `null` dimension score (e.g. body language on an audio-only session) should render a clear "not available for this session" note instead of a broken chart segment or a fabricated zero.

**Acceptance Criteria:**
- A real completed session's report renders all available data correctly.
- A session with a null body-language dimension shows the "not available" state clearly rather than a broken visual or misleading zero.
- The page handles a still-processing report gracefully if hit before the session is actually complete.

---

### TICKET 15 — Session History Page
**Priority:** Must-have
**Dependencies:** Ticket 14

**Description:** A list of the user's own past interview sessions.

**Build prompt:**
> Add a route `GET /api/sessions` returning the authenticated user's own sessions with `status: "complete"` (id, targetRole, companyStyle, overallScore, completedAt/updatedAt), most recent first. Create `src/features/session/pages/History.jsx` listing these as clickable cards navigating to `Report.jsx` for that session. Show a clear empty state ("You haven't completed an interview yet — start your first one") if the list is empty. If there are 2 or more sessions, show a simple line chart of `overallScore` over time above the list.

**Acceptance Criteria:**
- Only the logged-in user's own sessions appear — verified by testing with two different accounts.
- An account with zero completed sessions shows the empty state, not a blank page.
- The trend line only appears with 2+ sessions.

---

## Phase 5 — Hardening

### TICKET 16 — Account & Data Deletion
**Priority:** Must-have
**Dependencies:** All of Phase 4

**Description:** Extend account deletion to properly clean up the new data this feature introduces.

**Build prompt:**
> Add (or extend, if account deletion already exists elsewhere in the codebase — check for one before assuming there isn't) a route that, given the authenticated user, deletes their `User` document, all their `Resume` documents, and all their `InterviewSession` documents, including deleting the actual recording files referenced by those sessions from wherever they're stored (disk or cloud, per the Section 4.1 decision) — not just the database records. Add a confirmation step on the frontend before this action fires, since it's irreversible.

**Acceptance Criteria:**
- After deletion, the user cannot log in with their old credentials.
- No orphaned `Resume` or `InterviewSession` documents remain for the deleted user, verified by querying MongoDB directly.
- Recording files are actually removed from storage, not just dereferenced in the database.

---

### TICKET 17 — Gemini Resilience Audit
**Priority:** Must-have
**Dependencies:** All Gemini-calling tickets above (2, 4, 7, 11, 13)

**Description:** Confirm every new Gemini call added by this feature has the same resilience as the calls already in the codebase.

**Build prompt:**
> Review every function added in Tickets 2, 4, 7, 11, and 13 that calls Gemini (resume structuring, question generation, STAR evaluation, improved-answer suggestion, weak-topic identification) and confirm each one is wrapped in the existing `withAiRetry` helper from `ai.service.js`. Wrap any that aren't. Additionally, add a fallback for when retries are exhausted on question generation specifically: a small hardcoded pool of generic behavioral/technical questions, categorized by common `targetRole` values, used so a candidate is never left stuck mid-session if Gemini is unavailable.

**Acceptance Criteria:**
- Simulating a Gemini failure (e.g., temporarily using an invalid API key) causes question generation to fall back to a hardcoded question rather than crashing the session.
- Code review confirms every Gemini call added by this feature uses the shared retry helper.

---

## Execution Order Summary

1. Phase 1 (Tickets 1 → 2 → 3) — resume upload/parsing/review works end-to-end
2. Phase 2 (Tickets 4, 5 in parallel → 6 → 7) — the live interview loop works end-to-end with stubbed analysis
3. **Make the Feature Plan's Section 4 decisions (recording storage, transcription/vision provider) before starting Phase 3**
4. Phase 3 (Ticket 8 → 9, and Ticket 10 in parallel → 11) — real analysis replaces the stub
5. Phase 4 (Ticket 12 → 13 → 14 → 15) — reports and history go live with real data
6. Phase 5 (Tickets 16, 17) — hardening, done last once the full flow is stable
