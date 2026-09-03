import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getSessionReport } from "../services/session.api";
import "../style/session-report.scss";

const SessionReport = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [openTurnIndex, setOpenTurnIndex] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      try {
        setLoading(true);
        setError("");
        const res = await getSessionReport(sessionId);
        if (!isMounted) return;
        setSession(res.session);
        if (res.session?.turns?.length > 0) {
          setOpenTurnIndex(0); // Open first turn by default
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load interview report.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (sessionId) {
      loadReport();
    }

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="session-report-page">
        <div className="report-loading-box">
          <div className="report-spinner" />
          <h2>Generating Final Interview Report...</h2>
          <p>Aggregating scores, evaluating communication, and compiling feedback...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="session-report-page">
        <div className="report-error-card">
          <h2>Report Unavailable</h2>
          <p className="form-error">{error || "Could not load report details."}</p>
          <button
            type="button"
            className="report-back-btn"
            onClick={() => navigate("/")}
          >
            ← Return to Workspace
          </button>
        </div>
      </div>
    );
  }

  const { overallScore, dimensionScores, improvedAnswerSuggestion, weakTopics, turns } = session;

  const scoreColor =
    overallScore >= 80 ? "score--high" : overallScore >= 60 ? "score--mid" : "score--low";

  return (
    <div className="session-report-page">
      <div className="report-container">
        {/* Hero Section */}
        <header className="report-header">
          <div className="report-header__badge">Interview Practice Summary</div>
          <h1>Live Interview Performance Report</h1>
          <p className="report-header__sub">
            Target Role: <strong>{session.targetRole || "Software Engineer"}</strong> &bull;{" "}
            Domain: <strong>{session.targetDomain || "Engineering"}</strong>
          </p>
        </header>

        {/* Top Cards Grid */}
        <section className="report-metrics-grid">
          {/* Overall Score */}
          <div className="metric-card metric-card--hero">
            <span className="metric-card__title">Overall Session Score</span>
            <div className={`score-ring ${scoreColor}`}>
              <span className="score-ring__value">{overallScore ?? 75}</span>
              <span className="score-ring__pct">%</span>
            </div>
            <p className="score-ring__label">
              {overallScore >= 80
                ? "Excellent Interview Delivery!"
                : overallScore >= 60
                  ? "Solid Performance with Room for Polish"
                  : "Needs Focused Revision"}
            </p>
          </div>

          {/* Dimension Scores */}
          <div className="dimension-cards-wrapper">
            {/* Content Score */}
            <div className="metric-card dimension-card">
              <div className="dimension-card__header">
                <span className="dimension-icon">🧠</span>
                <span className="dimension-title">Content &amp; Accuracy</span>
              </div>
              <div className="dimension-score">
                {dimensionScores?.content !== null ? `${dimensionScores.content}%` : "N/A"}
              </div>
              <p className="dimension-sub">Relevance to job specifications</p>
            </div>

            {/* Communication Score */}
            <div className="metric-card dimension-card">
              <div className="dimension-card__header">
                <span className="dimension-icon">🎙️</span>
                <span className="dimension-title">Speech &amp; Delivery</span>
              </div>
              <div className="dimension-score">
                {dimensionScores?.communication !== null ? `${dimensionScores.communication}%` : "N/A"}
              </div>
              <p className="dimension-sub">Pace, clarity, &amp; filler word control</p>
            </div>

            {/* Body Language Score */}
            <div className="metric-card dimension-card">
              <div className="dimension-card__header">
                <span className="dimension-icon">👁️</span>
                <span className="dimension-title">Body Language</span>
              </div>
              <div className="dimension-score">
                {dimensionScores?.bodyLanguage !== null
                  ? `${dimensionScores.bodyLanguage}%`
                  : "Audio Only"}
              </div>
              <p className="dimension-sub">
                {dimensionScores?.bodyLanguage !== null
                  ? "Eye contact, posture, & confidence"
                  : "Not available for audio-only session"}
              </p>
            </div>
          </div>
        </section>

        {/* Feedback Section (Improved Answer & Weak Topics) */}
        <section className="report-feedback-grid">
          {/* Actionable Improvement */}
          <div className="feedback-card feedback-card--improvement">
            <h3>💡 Key Area for Improvement</h3>
            <p>{improvedAnswerSuggestion || "Focus on elaborating quantified metrics and technical decisions in your responses."}</p>
          </div>

          {/* Weak Topics to Revise */}
          <div className="feedback-card feedback-card--weaknesses">
            <h3>🎯 Weak Topics to Revise</h3>
            <div className="weak-topics-tags">
              {weakTopics && weakTopics.length > 0 ? (
                weakTopics.map((topic, idx) => (
                  <span key={idx} className="weak-topic-pill">
                    {topic}
                  </span>
                ))
              ) : (
                <span className="weak-topic-pill">Quantifiable achievements</span>
              )}
            </div>
          </div>
        </section>

        {/* Per-Turn Detailed Breakdown */}
        <section className="report-turns-section">
          <h2>Question Breakdown &amp; Analysis</h2>
          <div className="turns-accordion">
            {turns &&
              turns.map((turn, idx) => {
                const isOpen = openTurnIndex === idx;
                return (
                  <div key={idx} className={`turn-card ${isOpen ? "turn-card--open" : ""}`}>
                    <div
                      className="turn-card__header"
                      onClick={() => setOpenTurnIndex(isOpen ? null : idx)}
                    >
                      <div className="turn-card__info">
                        <span className="turn-number">Q{turn.questionIndex}</span>
                        <span className="turn-type-badge">{turn.questionType?.toUpperCase()}</span>
                        <span className="turn-topic-badge">{turn.topic}</span>
                        <h4 className="turn-question">{turn.questionText}</h4>
                      </div>

                      <div className="turn-card__meta">
                        <div className="turn-score">
                          Score: <strong>{turn.contentScore ?? 70}%</strong>
                        </div>
                        <span className={`accordion-chevron ${isOpen ? "chevron--open" : ""}`}>
                          ▼
                        </span>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="turn-card__body">
                        {/* Response Transcript */}
                        <div className="turn-section">
                          <h5>Candidate Answer Transcript</h5>
                          <div className="transcript-box">
                            {turn.transcript ? (
                              `"${turn.transcript}"`
                            ) : (
                              <em className="empty-transcript">No transcript recorded for this turn.</em>
                            )}
                          </div>
                        </div>

                        {/* Turn Scores Breakdown */}
                        <div className="turn-scores-row">
                          <div className="score-badge">
                            Content Score: <strong>{turn.contentScore ?? "N/A"}%</strong>
                          </div>
                          <div className="score-badge">
                            Speech Delivery: <strong>{turn.communicationScore ?? "N/A"}%</strong>
                          </div>
                          <div className="score-badge">
                            Body Language:{" "}
                            <strong>
                              {turn.bodyLanguageScore !== null
                                ? `${turn.bodyLanguageScore}%`
                                : "Audio Only"}
                            </strong>
                          </div>
                        </div>

                        {/* STAR Breakdown for Behavioral Questions */}
                        {turn.questionType === "behavioral" && turn.starBreakdown && (
                          <div className="star-breakdown-box">
                            <h5>STAR Method Evaluation</h5>
                            <div className="star-badges-grid">
                              <div
                                className={`star-badge ${turn.starBreakdown.situation ? "star-badge--pass" : "star-badge--fail"}`}
                              >
                                <span>{turn.starBreakdown.situation ? "✓" : "✗"}</span> Situation
                              </div>
                              <div
                                className={`star-badge ${turn.starBreakdown.task ? "star-badge--pass" : "star-badge--fail"}`}
                              >
                                <span>{turn.starBreakdown.task ? "✓" : "✗"}</span> Task
                              </div>
                              <div
                                className={`star-badge ${turn.starBreakdown.action ? "star-badge--pass" : "star-badge--fail"}`}
                              >
                                <span>{turn.starBreakdown.action ? "✓" : "✗"}</span> Action
                              </div>
                              <div
                                className={`star-badge ${turn.starBreakdown.result ? "star-badge--pass" : "star-badge--fail"}`}
                              >
                                <span>{turn.starBreakdown.result ? "✓" : "✗"}</span> Result
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>

        {/* Back to Workspace Action */}
        <div className="report-footer-actions">
          <button
            type="button"
            className="report-back-btn report-back-btn--primary"
            onClick={() => navigate("/")}
          >
            ← Back to Workspace Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionReport;
