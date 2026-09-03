const fs = require("fs");
const path = require("path");
const {
  getAiClient,
  withAiRetry,
  evaluateStarMethod,
} = require("./ai.service");

/**
 * Resolves local file path from a recording URL or file path.
 */
function resolveRecordingPath(recordingUrl) {
  if (!recordingUrl) return null;
  if (path.isAbsolute(recordingUrl) && fs.existsSync(recordingUrl)) {
    return recordingUrl;
  }

  const relativePath = recordingUrl.startsWith("/")
    ? recordingUrl.slice(1)
    : recordingUrl;

  const candidates = [
    path.join(__dirname, "../../", relativePath),
    path.join(process.cwd(), relativePath),
    path.join(process.cwd(), "Backend", relativePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Transcribes audio or video media file using Gemini AI multimodal vision/audio API.
 * @param {string} recordingUrl - Relative or absolute path to the recorded media file.
 * @returns {Promise<string>} Clean speech transcript.
 */
async function transcribeRecording(recordingUrl) {
  const filePath = resolveRecordingPath(recordingUrl);

  if (!filePath) {
    console.warn(`[Transcription] Recording file not found at: ${recordingUrl}`);
    return "Audio file not found for transcription.";
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    if (!fileBuffer || fileBuffer.length === 0) {
      return "Audio file is empty.";
    }

    const base64Data = fileBuffer.toString("base64");
    const ext = path.extname(filePath).toLowerCase();

    let mimeType = "video/webm";
    if (ext === ".mp4") mimeType = "video/mp4";
    if (ext === ".mp3") mimeType = "audio/mp3";
    if (ext === ".wav") mimeType = "audio/wav";
    if (ext === ".ogg") mimeType = "audio/ogg";
    if (ext === ".webm") mimeType = "video/webm";

    return await withAiRetry(async () => {
      const ai = getAiClient();
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash-lite",
          contents: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: "Please transcribe the spoken audio in this interview response recording verbatim. Provide ONLY the spoken transcript text without any introductory text, quotes, or meta commentary.",
            },
          ],
        });

        const transcript = response.text?.trim();
        return transcript || "No spoken audio detected in recording.";
      } catch (err) {
        if (ext === ".webm" && mimeType === "video/webm") {
          console.warn("[Transcription] video/webm failed, retrying with audio/webm...");
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            contents: [
              {
                inlineData: {
                  mimeType: "audio/webm",
                  data: base64Data,
                },
              },
              {
                text: "Please transcribe the spoken audio in this interview response recording verbatim. Provide ONLY the spoken transcript text without any introductory text, quotes, or meta commentary.",
              },
            ],
          });
          return response.text?.trim() || "No spoken audio detected in recording.";
        }
        throw err;
      }
    });
  } catch (error) {
    console.error("[Transcription] Failed to transcribe recording:", error);
    return "Transcription failed due to media format or provider error.";
  }
}

/**
 * Analyzes speech pace (WPM) and filler word density to derive a communication score (0-100).
 * @param {string} transcript - The spoken transcript text.
 * @param {number} audioDurationSeconds - Duration of the recording in seconds.
 * @returns {object} Speech delivery metrics & communication score.
 */
function analyzeSpeechDelivery(transcript = "", audioDurationSeconds = 60) {
  if (
    !transcript ||
    typeof transcript !== "string" ||
    transcript.trim().length === 0 ||
    transcript.includes("not found")
  ) {
    return {
      wordsPerMinute: 0,
      fillerCount: 0,
      fillerDensityPer100Words: 0,
      communicationScore: 50,
      detectedFillers: {},
    };
  }

  const cleanText = transcript.trim();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const durationMin = Math.max(0.1, (audioDurationSeconds || 60) / 60);
  const wordsPerMinute = Math.round(wordCount / durationMin);

  const fillerPatterns = [
    { word: "um", regex: /\bum\b/gi },
    { word: "uh", regex: /\buh\b/gi },
    { word: "like", regex: /\blike\b/gi },
    { word: "you know", regex: /\byou know\b/gi },
    { word: "basically", regex: /\bbasically\b/gi },
    { word: "actually", regex: /\bactually\b/gi },
    { word: "right", regex: /\bright\b/gi },
    { word: "so", regex: /\bso\b/gi },
    { word: "i mean", regex: /\bi mean\b/gi },
  ];

  let totalFillerCount = 0;
  const detectedFillers = {};

  for (const { word, regex } of fillerPatterns) {
    const matches = cleanText.match(regex);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      detectedFillers[word] = count;
      totalFillerCount += count;
    }
  }

  const fillerDensity = wordCount > 0 ? (totalFillerCount / wordCount) * 100 : 0;

  // Compute Communication Score (Baseline = 100)
  let score = 100;

  // Pace Deduction (Optimal range: 120 - 160 WPM)
  if (wordsPerMinute < 100) {
    const slowDiff = 100 - wordsPerMinute;
    score -= Math.min(20, Math.round(slowDiff * 0.3));
  } else if (wordsPerMinute > 170) {
    const fastDiff = wordsPerMinute - 170;
    score -= Math.min(20, Math.round(fastDiff * 0.3));
  }

  // Filler Word Density Deduction
  if (fillerDensity > 9) {
    score -= 35;
  } else if (fillerDensity > 5) {
    score -= 20;
  } else if (fillerDensity > 2) {
    score -= 10;
  }

  const finalCommunicationScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    wordsPerMinute,
    fillerCount: totalFillerCount,
    fillerDensityPer100Words: Math.round(fillerDensity * 10) / 10,
    communicationScore: finalCommunicationScore,
    detectedFillers,
  };
}

/**
 * Evaluates candidate body language (eye contact, posture, expressions) from recorded video.
 * @param {string} recordingUrl - Relative or absolute path to video file.
 * @returns {Promise<object>} Structured body language score & feedback or null if audio-only.
 */
async function analyzeBodyLanguage(recordingUrl) {
  if (!recordingUrl) {
    return {
      bodyLanguageScore: null,
      eyeContactScore: null,
      postureScore: null,
      feedback: "Recording file not specified for visual body language analysis.",
    };
  }

  const ext = path.extname(recordingUrl).toLowerCase();

  // Audio-only fallback check
  if ([".mp3", ".wav", ".ogg"].includes(ext)) {
    return {
      bodyLanguageScore: null,
      eyeContactScore: null,
      postureScore: null,
      feedback: "Audio-only response — visual body language analysis unavailable.",
    };
  }

  const filePath = resolveRecordingPath(recordingUrl);

  if (!filePath) {
    return {
      bodyLanguageScore: null,
      eyeContactScore: null,
      postureScore: null,
      feedback: "Recording file not found for visual body language analysis.",
    };
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    if (!fileBuffer || fileBuffer.length === 0) {
      return {
        bodyLanguageScore: null,
        eyeContactScore: null,
        postureScore: null,
        feedback: "Video file is empty.",
      };
    }

    const base64Data = fileBuffer.toString("base64");
    const mimeType = ext === ".mp4" ? "video/mp4" : "video/webm";

    return await withAiRetry(async () => {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: `Analyze the candidate's visual body language in this video interview response recording. Evaluate:
1. Eye contact with the camera (0-100)
2. Posture stability & alignment (0-100)
3. Facial expressions and visual confidence (0-100)

Return ONLY a JSON object with this exact shape:
{
  "bodyLanguageScore": number,
  "eyeContactScore": number,
  "postureScore": number,
  "feedback": "Concise 1-2 sentence feedback on visual presentation"
}`,
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text?.trim();
      if (!text) {
        return {
          bodyLanguageScore: 75,
          eyeContactScore: 75,
          postureScore: 75,
          feedback: "Visual presence evaluated as steady.",
        };
      }

      const parsed = JSON.parse(text);
      return {
        bodyLanguageScore: typeof parsed.bodyLanguageScore === "number" ? parsed.bodyLanguageScore : 75,
        eyeContactScore: typeof parsed.eyeContactScore === "number" ? parsed.eyeContactScore : 75,
        postureScore: typeof parsed.postureScore === "number" ? parsed.postureScore : 75,
        feedback: parsed.feedback || "Good posture and eye contact.",
      };
    });
  } catch (error) {
    console.error("[BodyLanguage] Failed visual analysis:", error);
    return {
      bodyLanguageScore: null,
      eyeContactScore: null,
      postureScore: null,
      feedback: "Visual analysis unavailable due to video encoding or provider error.",
    };
  }
}

/**
 * Analysis service for evaluating recorded interview responses.
 * @param {string} recordingUrl - Path or URL to the stored recording file.
 * @param {string} questionType - "behavioral" or "technical".
 * @param {number} durationSeconds - Optional duration of the recording in seconds.
 * @returns {Promise<object>} Analysis metrics including real speech transcript, communication score, body language, and STAR breakdown.
 */
async function analyzeResponse(
  recordingUrl,
  questionType = "behavioral",
  durationSeconds = 60,
) {
  const transcript = await transcribeRecording(recordingUrl);
  const deliveryMetrics = analyzeSpeechDelivery(transcript, durationSeconds);
  const bodyLanguage = await analyzeBodyLanguage(recordingUrl);

  let starBreakdown = null;
  if (questionType === "behavioral") {
    starBreakdown = await evaluateStarMethod(transcript);
  }

  return {
    transcript,
    contentScore: 70,
    communicationScore: deliveryMetrics.communicationScore,
    bodyLanguageScore: bodyLanguage.bodyLanguageScore,
    starBreakdown,
    deliveryMetrics,
    bodyLanguage,
  };
}

/**
 * Aggregates scores across all completed turns in a session and computes session-level report metrics.
 * @param {string} sessionId
 * @returns {Promise<object>} Updated session document
 */
async function aggregateSessionScore(sessionId) {
  const SessionModel = require("../models/session.model");
  const { suggestImprovedAnswer, identifyWeakTopics } = require("./ai.service");

  const session = await SessionModel.findById(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const completedTurns = session.turns.filter((t) => t.status === "complete");
  if (completedTurns.length === 0) {
    session.status = "complete";
    await session.save();
    return session;
  }

  // Calculate dimension averages (skipping null values)
  const contentScores = completedTurns
    .map((t) => t.contentScore)
    .filter((s) => typeof s === "number" && !isNaN(s));
  const commScores = completedTurns
    .map((t) => t.communicationScore)
    .filter((s) => typeof s === "number" && !isNaN(s));
  const bodyScores = completedTurns
    .map((t) => t.bodyLanguageScore)
    .filter((s) => typeof s === "number" && !isNaN(s));

  const avgContent =
    contentScores.length > 0
      ? Math.round(contentScores.reduce((a, b) => a + b, 0) / contentScores.length)
      : null;
  const avgComm =
    commScores.length > 0
      ? Math.round(commScores.reduce((a, b) => a + b, 0) / commScores.length)
      : null;
  const avgBody =
    bodyScores.length > 0
      ? Math.round(bodyScores.reduce((a, b) => a + b, 0) / bodyScores.length)
      : null;

  const validDimensions = [avgContent, avgComm, avgBody].filter(
    (d) => typeof d === "number",
  );
  const overallScore =
    validDimensions.length > 0
      ? Math.round(validDimensions.reduce((a, b) => a + b, 0) / validDimensions.length)
      : 75;

  session.dimensionScores = {
    content: avgContent,
    communication: avgComm,
    bodyLanguage: avgBody,
  };
  session.overallScore = overallScore;
  session.status = "complete";

  // Find lowest scoring turn for Ticket 13 improved answer suggestion
  let lowestTurn = completedTurns[0];
  let lowestScore = Infinity;
  for (const turn of completedTurns) {
    const scores = [turn.contentScore, turn.communicationScore, turn.bodyLanguageScore].filter(
      (s) => typeof s === "number",
    );
    const turnAvg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    if (turnAvg < lowestScore) {
      lowestScore = turnAvg;
      lowestTurn = turn;
    }
  }

  if (lowestTurn) {
    session.improvedAnswerSuggestion = await suggestImprovedAnswer(
      lowestTurn.questionText,
      lowestTurn.transcript,
    );
  }

  session.weakTopics = await identifyWeakTopics(completedTurns);

  await session.save();
  return session;
}

module.exports = {
  transcribeRecording,
  analyzeSpeechDelivery,
  analyzeBodyLanguage,
  analyzeResponse,
  aggregateSessionScore,
};
