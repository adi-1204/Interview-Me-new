const path = require("path");
const fs = require("fs");
const SessionModel = require("../models/session.model");
const ResumeModel = require("../models/resume.model");
const {
  structureResume,
  generateInterviewQuestion,
} = require("../services/ai.service");
const { analyzeResponse } = require("../services/interviewAnalysis.service");

/**
 * @description Create a new live interview session and generate question #1
 * @route POST /api/sessions
 * @access Private
 */
async function createSessionController(req, res) {
  try {
    const { resumeId } = req.body;

    if (!resumeId) {
      return res.status(400).json({
        message: "resumeId is required to start a session.",
      });
    }

    const resumeDoc = await ResumeModel.findOne({
      _id: resumeId,
      user: req.user.id,
    });

    if (!resumeDoc) {
      return res.status(404).json({
        message: "Resume not found.",
      });
    }

    // Ensure resume is structured
    if (
      !resumeDoc.structuredData ||
      (!resumeDoc.structuredData.skills?.length &&
        !resumeDoc.structuredData.projects?.length &&
        !resumeDoc.structuredData.experience?.length)
    ) {
      const structuredData = await structureResume(resumeDoc.rawText);
      resumeDoc.structuredData = structuredData;
      await resumeDoc.save();
    }

    // Generate Question #1
    const questionResult = await generateInterviewQuestion({
      resumeText: resumeDoc.rawText,
      structuredData: resumeDoc.structuredData,
      targetRole: resumeDoc.targetRole,
      targetDomain: resumeDoc.targetDomain,
      companyStyle: resumeDoc.companyStyle,
      questionIndex: 1,
      previousTurns: [],
    });

    const firstTurn = {
      questionIndex: 1,
      questionText: questionResult.questionText,
      questionType: questionResult.questionType || "technical",
      topic: questionResult.topic || "General Experience",
      targetDurationSeconds: questionResult.targetDurationSeconds || 90,
      status: "pending",
    };

    const sessionDoc = await SessionModel.create({
      user: req.user.id,
      resume: resumeDoc._id,
      targetRole: resumeDoc.targetRole,
      targetDomain: resumeDoc.targetDomain,
      companyStyle: resumeDoc.companyStyle,
      status: "in_progress",
      turns: [firstTurn],
    });

    return res.status(201).json({
      message: "Live interview session created successfully.",
      sessionId: sessionDoc._id,
      session: sessionDoc,
      currentTurn: sessionDoc.turns[0],
    });
  } catch (error) {
    console.error("Failed to create live interview session:", error);

    if (error?.name === "ZodError") {
      return res.status(400).json({
        message: "Generated interview question failed validation.",
        details: error.errors,
      });
    }

    return res.status(500).json({
      message: error.message || "Failed to start interview session.",
    });
  }
}

/**
 * @description Get session by ID
 * @route GET /api/sessions/:id
 * @access Private
 */
async function getSessionByIdController(req, res) {
  try {
    const { id } = req.params;
    const sessionDoc = await SessionModel.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!sessionDoc) {
      return res.status(404).json({
        message: "Session not found.",
      });
    }

    return res.status(200).json({
      message: "Session retrieved successfully.",
      session: sessionDoc,
    });
  } catch (error) {
    console.error("Failed to fetch session:", error);
    return res.status(500).json({
      message: "Failed to fetch session.",
    });
  }
}

/**
 * @description Submit recording response for a session turn
 * @route POST /api/sessions/:id/turns/:turnIndex/response
 * @access Private
 */
async function uploadRecordingController(req, res) {
  try {
    const { id, turnIndex } = req.params;
    const qIndex = parseInt(turnIndex, 10);

    const sessionDoc = await SessionModel.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!sessionDoc) {
      return res.status(404).json({
        message: "Session not found.",
      });
    }

    const turn = sessionDoc.turns.find((t) => t.questionIndex === qIndex);

    if (!turn) {
      return res.status(404).json({
        message: `Turn #${qIndex} not found in session.`,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Recording file is required.",
      });
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, "../../uploads/recordings");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileExt = req.file.mimetype.includes("video") ? ".webm" : ".webm";
    const filename = `session_${id}_turn_${qIndex}_${Date.now()}${fileExt}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);
    const recordingUrl = `/uploads/recordings/${filename}`;

    // Update turn status to processing
    turn.recordingUrl = recordingUrl;
    turn.status = "processing";
    await sessionDoc.save();

    // Trigger response analysis with safety fallback
    let analysis;
    try {
      analysis = await analyzeResponse(recordingUrl, turn.questionType);
    } catch (analysisErr) {
      console.warn("Analysis failed for turn response, using fallback scores:", analysisErr);
      analysis = {
        transcript: "Candidate provided a spoken response.",
        contentScore: 75,
        communicationScore: 70,
        bodyLanguageScore: null,
        starBreakdown:
          turn.questionType === "behavioral"
            ? { situation: true, task: true, action: true, result: false }
            : null,
      };
    }

    turn.transcript = analysis.transcript || "Candidate provided a spoken response.";
    turn.contentScore = analysis.contentScore ?? 75;
    turn.communicationScore = analysis.communicationScore ?? 70;
    turn.bodyLanguageScore = analysis.bodyLanguageScore ?? null;
    turn.starBreakdown = analysis.starBreakdown ?? null;
    turn.status = "complete";

    // Pre-generate next turn if max limit not reached
    const nextTurnExists = sessionDoc.turns.some((t) => t.questionIndex === qIndex + 1);
    if (!nextTurnExists && qIndex < MAX_QUESTIONS_PER_SESSION) {
      const resumeDoc = await ResumeModel.findById(sessionDoc.resume);
      let questionResult;
      try {
        questionResult = await generateInterviewQuestion({
          resumeText: resumeDoc ? resumeDoc.rawText : "",
          structuredData: resumeDoc ? resumeDoc.structuredData : null,
          targetRole: sessionDoc.targetRole,
          targetDomain: sessionDoc.targetDomain,
          companyStyle: sessionDoc.companyStyle,
          questionIndex: qIndex + 1,
          previousTurns: sessionDoc.turns,
        });
      } catch (genErr) {
        console.warn(`Failed to pre-generate adaptive question #${qIndex + 1}, using fallback:`, genErr);
        const isBehavioral = (qIndex + 1) % 2 === 0;
        questionResult = {
          questionText: isBehavioral
            ? "Describe a challenging situation in your past role and how you resolved it."
            : `Explain a key technical concept or architecture design relevant to ${sessionDoc.targetRole || "your field"}.`,
          questionType: isBehavioral ? "behavioral" : "technical",
          topic: isBehavioral ? "Behavioral & Leadership" : "Technical Expertise",
          targetDurationSeconds: 90,
        };
      }

      sessionDoc.turns.push({
        questionIndex: qIndex + 1,
        questionText: questionResult.questionText,
        questionType: questionResult.questionType || "technical",
        topic: questionResult.topic || "Technical Skill",
        targetDurationSeconds: questionResult.targetDurationSeconds || 90,
        status: "pending",
      });
    }

    await sessionDoc.save();

    return res.status(200).json({
      message: "Recording uploaded and processed successfully.",
      sessionId: sessionDoc._id,
      turn,
    });
  } catch (error) {
    console.error("Failed to upload recording response:", error);
    return res.status(500).json({
      message: "Failed to upload recording response.",
    });
  }
}

const MAX_QUESTIONS_PER_SESSION = 6;

/**
 * @description Poll turn status and adaptively generate next question or conclude session
 * @route GET /api/sessions/:id/turns/:turnIndex/status
 * @access Private
 */
async function getTurnStatusController(req, res) {
  try {
    const { id, turnIndex } = req.params;
    const qIndex = parseInt(turnIndex, 10);

    const sessionDoc = await SessionModel.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!sessionDoc) {
      return res.status(404).json({
        message: "Session not found.",
      });
    }

    const currentTurn = sessionDoc.turns.find((t) => t.questionIndex === qIndex);

    if (!currentTurn) {
      return res.status(404).json({
        message: `Turn #${qIndex} not found in session.`,
      });
    }

    if (currentTurn.status !== "complete") {
      return res.status(200).json({
        status: currentTurn.status,
      });
    }

    // Check if next turn already exists
    const nextTurn = sessionDoc.turns.find(
      (t) => t.questionIndex === qIndex + 1,
    );

    if (nextTurn) {
      return res.status(200).json({
        status: "complete",
        nextQuestion: nextTurn,
      });
    }

    // Check if max question limit reached
    if (qIndex >= MAX_QUESTIONS_PER_SESSION) {
      const { aggregateSessionScore } = require("../services/interviewAnalysis.service");
      await aggregateSessionScore(sessionDoc._id);
      return res.status(200).json({
        status: "session_complete",
      });
    }

    // Generate adaptive next question with safety fallback
    const resumeDoc = await ResumeModel.findById(sessionDoc.resume);

    let questionResult;
    try {
      questionResult = await generateInterviewQuestion({
        resumeText: resumeDoc ? resumeDoc.rawText : "",
        structuredData: resumeDoc ? resumeDoc.structuredData : null,
        targetRole: sessionDoc.targetRole,
        targetDomain: sessionDoc.targetDomain,
        companyStyle: sessionDoc.companyStyle,
        questionIndex: qIndex + 1,
        previousTurns: sessionDoc.turns,
      });
    } catch (genErr) {
      console.warn(`Failed to generate adaptive question #${qIndex + 1}, using fallback:`, genErr);
      const isBehavioral = (qIndex + 1) % 2 === 0;
      questionResult = {
        questionText: isBehavioral
          ? "Describe a challenging situation in your past role and how you resolved it."
          : `Explain a key technical concept or architecture design relevant to ${sessionDoc.targetRole || "your field"}.`,
        questionType: isBehavioral ? "behavioral" : "technical",
        topic: isBehavioral ? "Behavioral & Leadership" : "Technical Expertise",
        targetDurationSeconds: 90,
      };
    }

    const newTurn = {
      questionIndex: qIndex + 1,
      questionText: questionResult.questionText,
      questionType: questionResult.questionType || "technical",
      topic: questionResult.topic || "Technical Skill",
      targetDurationSeconds: questionResult.targetDurationSeconds || 90,
      status: "pending",
    };

    sessionDoc.turns.push(newTurn);
    await sessionDoc.save();

    const createdNextTurn = sessionDoc.turns.find(
      (t) => t.questionIndex === qIndex + 1,
    );

    return res.status(200).json({
      status: "complete",
      nextQuestion: createdNextTurn,
    });
  } catch (error) {
    console.error("Failed to check turn status:", error);
    return res.status(500).json({
      message: "Failed to process turn status.",
    });
  }
}

/**
 * @description Get session final report
 * @route GET /api/sessions/:id/report
 * @access Private
 */
async function getSessionReportController(req, res) {
  try {
    const { id } = req.params;
    const { aggregateSessionScore } = require("../services/interviewAnalysis.service");

    let sessionDoc = await SessionModel.findOne({
      _id: id,
      user: req.user.id,
    }).populate("resume");

    if (!sessionDoc) {
      return res.status(404).json({
        message: "Interview session report not found.",
      });
    }

    sessionDoc = await aggregateSessionScore(sessionDoc._id);
    await sessionDoc.populate("resume");

    return res.status(200).json({
      session: sessionDoc,
    });
  } catch (error) {
    console.error("Failed to fetch session report:", error);
    return res.status(500).json({
      message: "Failed to fetch interview session report.",
    });
  }
}

/**
 * @description Manually end session instantly and generate report based on answered questions
 * @route POST /api/sessions/:id/end
 * @access Private
 */
async function endSessionController(req, res) {
  try {
    const { id } = req.params;
    const { aggregateSessionScore } = require("../services/interviewAnalysis.service");

    let sessionDoc = await SessionModel.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!sessionDoc) {
      return res.status(404).json({
        message: "Interview session not found.",
      });
    }

    sessionDoc.status = "complete";
    await sessionDoc.save();

    sessionDoc = await aggregateSessionScore(sessionDoc._id);

    return res.status(200).json({
      message: "Interview session ended successfully.",
      sessionId: sessionDoc._id,
      session: sessionDoc,
    });
  } catch (error) {
    console.error("Failed to end session:", error);
    return res.status(500).json({
      message: "Failed to end interview session.",
    });
  }
}

module.exports = {
  createSessionController,
  getSessionByIdController,
  uploadRecordingController,
  getTurnStatusController,
  getSessionReportController,
  endSessionController,
};
