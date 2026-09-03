import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import MediaRecorderView from "../components/MediaRecorderView";
import { getSessionById, uploadTurnResponse, endSession } from "../services/session.api";
import "../style/live-interview.scss";

const LiveInterview = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        setLoading(true);
        setError("");
        const res = await getSessionById(sessionId);

        if (!isMounted) return;
        setSession(res.session);

        const turns = res.session?.turns || [];
        const pendingTurn = turns.find((t) => t.status === "pending");

        if (pendingTurn) {
          setCurrentTurn(pendingTurn);
          setRecordedBlob(null);
        } else if (
          res.session?.status === "complete" ||
          (turns.length > 0 && turns.every((t) => t.status === "complete"))
        ) {
          navigate(`/session/${sessionId}/report`);
          return;
        } else {
          setCurrentTurn(turns[turns.length - 1]);
          setRecordedBlob(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load interview session.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (sessionId) {
      loadSession();
    }

    return () => {
      isMounted = false;
    };
  }, [sessionId, navigate]);

  const handleRecordingComplete = (blob) => {
    setRecordedBlob(blob);
  };

  const handleSubmitAnswer = async () => {
    if (!recordedBlob || !currentTurn) return;

    try {
      setSubmitting(true);
      setError("");

      await uploadTurnResponse({
        sessionId,
        turnIndex: currentTurn.questionIndex,
        recordingBlob: recordedBlob,
      });

      navigate(`/session/${sessionId}/processing/${currentTurn.questionIndex}`);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload answer recording.",
      );
      setSubmitting(false);
    }
  };

  const handleEndInterview = async () => {
    if (
      !window.confirm(
        "Are you sure you want to end the interview now? Your final report will be generated based on the questions answered so far.",
      )
    ) {
      return;
    }

    try {
      setEndingSession(true);
      await endSession(sessionId);
      navigate(`/session/${sessionId}/report`);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to end interview.",
      );
      setEndingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="live-interview-page">
        <div className="review-loading">
          <h2>Loading Live Interview Session...</h2>
        </div>
      </div>
    );
  }

  if (error && !currentTurn) {
    return (
      <div className="live-interview-page">
        <div className="review-container">
          <p className="form-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-interview-page">
      <div className="live-container">
        {/* Header Bar with End Interview */}
        <div className="live-header-bar">
          <div className="live-header-bar__title">Live Practice Session</div>
          <button
            type="button"
            className="end-interview-btn"
            disabled={endingSession || submitting}
            onClick={handleEndInterview}
          >
            {endingSession ? "Ending Interview..." : "⏹ End Interview"}
          </button>
        </div>

        {/* Question Card */}
        <div className="question-card">
          <div className="question-card__meta">
            <span className="question-card__eyebrow">
              Question #{currentTurn?.questionIndex || 1} &bull;{" "}
              {currentTurn?.questionType?.toUpperCase()}
            </span>
            <span className="badge badge--best">{currentTurn?.topic}</span>
          </div>

          <h2>{currentTurn?.questionText}</h2>
        </div>

        {/* Camera / Mic Recorder */}
        <MediaRecorderView
          key={currentTurn?.questionIndex || 1}
          targetDurationSeconds={currentTurn?.targetDurationSeconds || 90}
          onRecordingComplete={handleRecordingComplete}
        />

        {/* Submit Section */}
        {recordedBlob && (
          <div className="submit-section">
            <button
              type="button"
              className="submit-btn"
              disabled={submitting}
              onClick={handleSubmitAnswer}
            >
              {submitting ? "Uploading Response..." : "Submit Answer & Analyze →"}
            </button>
            {error && <p className="form-error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveInterview;
