import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { pollTurnStatus } from "../services/session.api";
import "../style/processing.scss";

const Processing = () => {
  const { sessionId, turnIndex } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let isStopped = false;
    let timerId = null;

    async function checkStatus() {
      if (isStopped) return;

      try {
        const res = await pollTurnStatus({ sessionId, turnIndex });

        if (isStopped) return;

        if (res.status === "session_complete") {
          isStopped = true;
          if (timerId) clearInterval(timerId);
          // Navigate to full live interview session report
          navigate(`/session/${sessionId}/report`);
          return;
        }

        if (res.status === "complete" && res.nextQuestion) {
          isStopped = true;
          if (timerId) clearInterval(timerId);
          // Navigate to next live question
          navigate(`/session/live/${sessionId}`);
          return;
        }
      } catch (err) {
        if (!isStopped) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Error checking response status.",
          );
        }
      }
    }

    // Run immediate check
    checkStatus();

    // Poll every 2000ms
    timerId = setInterval(checkStatus, 2000);

    return () => {
      isStopped = true;
      if (timerId) clearInterval(timerId);
    };
  }, [sessionId, turnIndex, navigate]);

  return (
    <div className="processing-page">
      <div className="processing-card">
        <div className="pulse-ring-wrapper">
          <div className="pulse-ring" />
          <div className="pulse-ring-inner">🧠</div>
        </div>

        <div className="processing-info">
          <h2>Analyzing Answer &amp; Preparing Next Question</h2>
          <p>
            Gemini is evaluating turn #{turnIndex} and generating the next adaptive
            question for your role...
          </p>
        </div>

        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
};

export default Processing;
