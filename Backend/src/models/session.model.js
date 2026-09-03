const mongoose = require("mongoose");

const turnSchema = new mongoose.Schema({
  questionIndex: {
    type: Number,
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  questionType: {
    type: String,
    enum: ["technical", "behavioral"],
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  targetDurationSeconds: {
    type: Number,
    default: 90,
  },
  recordingUrl: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ["pending", "processing", "complete", "failed"],
    default: "pending",
  },
  transcript: {
    type: String,
    default: "",
  },
  contentScore: {
    type: Number,
    default: null,
  },
  communicationScore: {
    type: Number,
    default: null,
  },
  bodyLanguageScore: {
    type: Number,
    default: null,
  },
  starBreakdown: {
    situation: { type: Boolean, default: null },
    task: { type: Boolean, default: null },
    action: { type: Boolean, default: null },
    result: { type: Boolean, default: null },
  },
  feedback: {
    type: String,
    default: "",
  },
});

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    resume: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
    },
    targetRole: {
      type: String,
      default: "",
    },
    targetDomain: {
      type: String,
      default: "",
    },
    companyStyle: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["in_progress", "complete"],
      default: "in_progress",
    },
    overallScore: {
      type: Number,
      default: null,
    },
    dimensionScores: {
      content: { type: Number, default: null },
      communication: { type: Number, default: null },
      bodyLanguage: { type: Number, default: null },
    },
    improvedAnswerSuggestion: {
      type: String,
      default: "",
    },
    weakTopics: {
      type: [String],
      default: [],
    },
    turns: [turnSchema],
  },
  {
    timestamps: true,
  },
);

const SessionModel = mongoose.model("Session", sessionSchema);

module.exports = SessionModel;
