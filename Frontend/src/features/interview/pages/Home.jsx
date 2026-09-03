import React, { useRef, useState } from "react";
import "../style/home.scss";
import { useInterview } from "../hooks/useInterview.js";
import { askQuestionFromPdf } from "../services/interview.api.js";
import { uploadSessionResume } from "../../session/services/session.api.js";
import { useNavigate } from "react-router";

const Home = () => {
  const { loading, error, setError, generateReport, reports } = useInterview();
  const [jobDescription, setJobDescription] = useState("");
  const [selfDescription, setSelfDescription] = useState("");
  const [selectedResumeName, setSelectedResumeName] = useState("");
  const [selectedPdfName, setSelectedPdfName] = useState("");
  const [pdfQuestion, setPdfQuestion] = useState("");
  const [pdfAnswer, setPdfAnswer] = useState("");
  const [pdfSupportingPoints, setPdfSupportingPoints] = useState([]);
  const [pdfSources, setPdfSources] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const resumeInputRef = useRef();
  const pdfInputRef = useRef();

  // Live Interview State
  const [liveRole, setLiveRole] = useState("");
  const [liveDomain, setLiveDomain] = useState("");
  const [liveCompanyStyle, setLiveCompanyStyle] = useState("");
  const [selectedLiveResumeName, setSelectedLiveResumeName] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const liveResumeInputRef = useRef();

  const navigate = useNavigate();

  const validatePdfFile = (file, setFileName, setLocalError, eventTarget) => {
    if (!file) {
      setFileName("");
      return false;
    }

    const isPdfName = file.name?.toLowerCase().endsWith(".pdf");
    if (!isPdfName) {
      setFileName("");
      setLocalError("Please upload a PDF file.");
      eventTarget.value = "";
      return false;
    }

    const maxFileSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      setFileName("");
      setLocalError("PDF file must be 5MB or smaller.");
      eventTarget.value = "";
      return false;
    }

    setLocalError("");
    setFileName(file.name);
    return true;
  };

  const handleResumeChange = (event) => {
    const file = event.target.files?.[0];
    validatePdfFile(file, setSelectedResumeName, setError, event.target);
  };

  const handleLiveResumeChange = (event) => {
    const file = event.target.files?.[0];
    validatePdfFile(
      file,
      setSelectedLiveResumeName,
      setLiveError,
      event.target,
    );
  };

  const handlePdfChange = (event) => {
    const file = event.target.files?.[0];
    validatePdfFile(file, setSelectedPdfName, setPdfError, event.target);
  };

  const handleGenerateReport = async () => {
    const resumeFile = resumeInputRef.current.files[0];

    if (!resumeFile && !selfDescription.trim()) {
      setError("Upload a resume or add a self-description to continue.");
      return;
    }

    try {
      const data = await generateReport({
        jobDescription,
        selfDescription,
        resumeFile,
      });
      if (data?._id) {
        navigate(`/interview/${data._id}`);
      }
    } catch {
      // Error state is handled by interview context and rendered below the action button.
    }
  };

  const handleStartLiveInterview = async () => {
    const resumeFile = liveResumeInputRef.current?.files?.[0];

    if (!resumeFile) {
      setLiveError(
        "Please select a PDF resume to start live interview practice.",
      );
      return;
    }

    setLiveLoading(true);
    setLiveError("");

    try {
      const res = await uploadSessionResume({
        resumeFile,
        targetRole: liveRole,
        targetDomain: liveDomain,
        companyStyle: liveCompanyStyle,
      });

      const resumeId = res?.resumeId || res?.resume?._id || res?._id;
      if (resumeId) {
        navigate(`/session/resume-review/${resumeId}`);
      } else {
        setLiveError("Failed to initialize resume session.");
      }
    } catch (err) {
      setLiveError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload resume for live interview practice.",
      );
    } finally {
      setLiveLoading(false);
    }
  };

  const handleAskFromPdf = async () => {
    const pdfFile = pdfInputRef.current.files[0];

    if (!pdfFile) {
      setPdfError("Upload a PDF document to ask questions from it.");
      return;
    }

    if (!pdfQuestion.trim()) {
      setPdfError("Enter a question for the uploaded PDF.");
      return;
    }

    setPdfLoading(true);
    setPdfError("");
    setPdfAnswer("");
    setPdfSupportingPoints([]);
    setPdfSources([]);

    try {
      const data = await askQuestionFromPdf({
        pdfFile,
        question: pdfQuestion,
      });
      setPdfAnswer(data?.answer || "No answer could be generated.");
      setPdfSupportingPoints(
        Array.isArray(data?.supportingPoints) ? data.supportingPoints : [],
      );
      setPdfSources(Array.isArray(data?.sources) ? data.sources : []);
    } catch (err) {
      setPdfError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to analyze the PDF.",
      );
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loading-screen__content loading-screen__content--analysis">
          <p>Analysing your resume...</p>
          <h1>Loading your interview plan...</h1>
        </div>
      </main>
    );
  }

  return (
    <div className="home-page">
      <header className="page-header">
        <div className="page-header__eyebrow">InterviewMe Workspace</div>
        <div className="page-header__content">
          <div className="page-header__copy">
            <h1>
              Build sharper interview plans and learn smarter from PDFs.
            </h1>
            <p>
              One private workspace for resume analysis, interactive live
              interview practice, and document-based answers powered by RAG.
            </p>
          </div>

          <div className="page-header__stats">
            <div className="workspace-pill">
              <span className="workspace-pill__label">Mode</span>
              <strong>Secure AI Prep</strong>
            </div>
            <div className="workspace-pill">
              <span className="workspace-pill__label">Inputs</span>
              <strong>Resume, Role, Video</strong>
            </div>
            <div className="workspace-pill">
              <span className="workspace-pill__label">Output</span>
              <strong>Adaptive Live Interview</strong>
            </div>
          </div>
        </div>
      </header>

      <div className="home-workspace">
        {/* Primary Flow: Live Interview Practice Card */}
        <section className="interview-card">
          <div className="workspace-section-heading">
            <div>
              <p className="workspace-section-heading__eyebrow">
                PRIMARY FLOW
              </p>
              <h2>Live Interview Practice Mode</h2>
              <p className="workspace-section-heading__sub">
                Upload your resume for real-time camera and microphone practice with
                Gemini AI adaptive questions.
              </p>
            </div>
            <span className="badge badge--best">Interactive Video AI</span>
          </div>

          <div className="interview-card__body">
            <div className="interview-grid">
              <div className="panel panel--left">
                <div className="panel__header">
                  <span className="panel__step">01</span>
                  <div className="panel__title-group">
                    <h2>Target Job &amp; Style</h2>
                    <p>Specify the role details you want Gemini to interview you for.</p>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.85rem",
                  }}
                >
                  <div>
                    <label className="section-label">Target Role</label>
                    <input
                      type="text"
                      className="panel__textarea panel__textarea--short"
                      style={{ minHeight: "48px" }}
                      placeholder="e.g. Senior Frontend Engineer"
                      value={liveRole}
                      onChange={(e) => setLiveRole(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="section-label">Target Domain</label>
                    <input
                      type="text"
                      className="panel__textarea panel__textarea--short"
                      style={{ minHeight: "48px" }}
                      placeholder="e.g. Fintech / SaaS"
                      value={liveDomain}
                      onChange={(e) => setLiveDomain(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="section-label">Company Style</label>
                    <input
                      type="text"
                      className="panel__textarea panel__textarea--short"
                      style={{ minHeight: "48px" }}
                      placeholder="e.g. FAANG / Startup / Strict"
                      value={liveCompanyStyle}
                      onChange={(e) => setLiveCompanyStyle(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="panel panel--right">
                <div className="panel__header">
                  <span className="panel__step">02</span>
                  <div className="panel__title-group">
                    <h2>Upload PDF Resume</h2>
                    <p>Gemini will structure your skills, projects, and experience.</p>
                  </div>
                  <span className="badge badge--required">Required</span>
                </div>

                <div className="profile-stack">
                  <div className="upload-section">
                    <label className="section-label">
                      Upload Resume
                      <span className="badge badge--best">Best Results</span>
                    </label>
                    <label className="dropzone" htmlFor="liveResume">
                      <span className="dropzone__icon">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="23 7 16 12 23 17 23 7" />
                          <rect
                            x="1"
                            y="5"
                            width="15"
                            height="14"
                            rx="2"
                            ry="2"
                          />
                        </svg>
                      </span>
                      <p className="dropzone__title">
                        Click to upload resume for Live Practice
                      </p>
                      <p className="dropzone__subtitle">PDF only (Max 5MB)</p>
                      <input
                        ref={liveResumeInputRef}
                        onChange={handleLiveResumeChange}
                        hidden
                        type="file"
                        id="liveResume"
                        name="liveResume"
                        accept=".pdf,application/pdf"
                      />
                    </label>
                    {selectedLiveResumeName && (
                      <p className="dropzone__subtitle">
                        Selected: {selectedLiveResumeName}
                      </p>
                    )}
                  </div>

                  <div className="info-box">
                    <span className="info-box__icon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line
                          x1="12"
                          y1="8"
                          x2="12"
                          y2="12"
                          stroke="#1a1f27"
                          strokeWidth="2"
                        />
                        <line
                          x1="12"
                          y1="16"
                          x2="12.01"
                          y2="16"
                          stroke="#1a1f27"
                          strokeWidth="2"
                        />
                      </svg>
                    </span>
                    <p>
                      A <strong>PDF Resume</strong> is required to generate adaptive multi-turn questions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="interview-card__footer">
            <span className="footer-info">
              Interactive Camera/Mic Recording &bull; Step 1 of 3 (Review &amp; Refine)
            </span>
            <button
              onClick={handleStartLiveInterview}
              disabled={liveLoading}
              className="generate-btn"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {liveLoading
                ? "Parsing Resume..."
                : "Start Live Interview Practice →"}
            </button>
          </div>
          {liveError && <p className="form-error">{liveError}</p>}
        </section>

        {/* Secondary Flow: One-Shot Strategy Card */}
        <section className="interview-card">
          <div className="workspace-section-heading">
            <div>
              <p className="workspace-section-heading__eyebrow">
                Interview Strategy
              </p>
              <h2>Create your main analysis</h2>
              <p className="workspace-section-heading__sub">
                Map the role, add your profile, and generate a focused
                preparation plan.
              </p>
            </div>
            <span className="badge badge--required">Strategy Report</span>
          </div>

          <div className="interview-card__body">
            <div className="interview-grid">
              <div className="panel panel--left">
                <div className="panel__header">
                  <span className="panel__step">01</span>
                  <div className="panel__title-group">
                    <h2>Target Job Description</h2>
                    <p>Paste the role brief you want to prepare for.</p>
                  </div>
                  <span className="badge badge--required">Required</span>
                </div>
                <textarea
                  value={jobDescription}
                  onChange={(e) => {
                    setJobDescription(e.target.value);
                  }}
                  className="panel__textarea"
                  placeholder={`Paste the full job description here...\ne.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'`}
                  maxLength={5000}
                />
                <div className="char-counter">
                  {jobDescription.length} / 5000 chars
                </div>
              </div>

              <div className="panel panel--right">
                <div className="panel__header">
                  <span className="panel__step">02</span>
                  <div className="panel__title-group">
                    <h2>Your Profile</h2>
                    <p>Upload your resume or write a quick self-summary.</p>
                  </div>
                </div>

                <div className="profile-stack">
                  <div className="upload-section">
                    <label className="section-label">
                      Upload Resume
                      <span className="badge badge--best">Best Results</span>
                    </label>
                    <label className="dropzone" htmlFor="resume">
                      <span className="dropzone__icon">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="16 16 12 12 8 16" />
                          <line x1="12" y1="12" x2="12" y2="21" />
                          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                        </svg>
                      </span>
                      <p className="dropzone__title">
                        Click to upload or drag &amp; drop
                      </p>
                      <p className="dropzone__subtitle">PDF only (Max 5MB)</p>
                      <input
                        ref={resumeInputRef}
                        onChange={handleResumeChange}
                        hidden
                        type="file"
                        id="resume"
                        name="resume"
                        accept=".pdf,application/pdf"
                      />
                    </label>
                    {selectedResumeName && (
                      <p className="dropzone__subtitle">
                        Selected: {selectedResumeName}
                      </p>
                    )}
                  </div>

                  <div className="or-divider">
                    <span>OR</span>
                  </div>

                  <div className="self-description">
                    <label className="section-label" htmlFor="selfDescription">
                      Quick Self-Description
                    </label>
                    <textarea
                      onChange={(e) => {
                        setSelfDescription(e.target.value);
                      }}
                      id="selfDescription"
                      name="selfDescription"
                      className="panel__textarea panel__textarea--short"
                      placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
                    />
                  </div>

                  <div className="info-box">
                    <span className="info-box__icon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line
                          x1="12"
                          y1="8"
                          x2="12"
                          y2="12"
                          stroke="#1a1f27"
                          strokeWidth="2"
                        />
                        <line
                          x1="12"
                          y1="16"
                          x2="12.01"
                          y2="16"
                          stroke="#1a1f27"
                          strokeWidth="2"
                        />
                      </svg>
                    </span>
                    <p>
                      Either a <strong>Resume</strong> or a{" "}
                      <strong>Self Description</strong> is required to generate a
                      personalized plan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="interview-card__footer">
            <span className="footer-info">
              AI-Powered Strategy Generation &bull; Approx 30s
            </span>
            <button onClick={handleGenerateReport} className="generate-btn">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
              Generate My Interview Strategy
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </section>
      </div>

      {reports.length > 0 && (
        <section className="recent-reports">
          <h2>My Recent Interview Plans</h2>
          <ul className="reports-list">
            {reports.map((report) => (
              <li
                key={report._id}
                className="report-item"
                onClick={() => navigate(`/interview/${report._id}`)}
              >
                <h3>{report.title || "Untitled Position"}</h3>
                <p className="report-meta">
                  Generated on {new Date(report.createdAt).toLocaleDateString()}
                </p>
                <p
                  className={`match-score ${report.matchScore >= 80 ? "score--high" : report.matchScore >= 60 ? "score--mid" : "score--low"}`}
                >
                  Match Score: {report.matchScore}%
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="page-footer">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
        <a href="#">Help Center</a>
      </footer>
    </div>
  );
};

export default Home;
