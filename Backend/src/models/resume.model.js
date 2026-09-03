const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    rawText: {
      type: String,
      required: true,
    },
    structuredData: {
      skills: [{ type: String }],
      projects: [
        {
          name: { type: String },
          description: { type: String },
          technologies: { type: String },
        },
      ],
      experience: [
        {
          role: { type: String },
          company: { type: String },
          description: { type: String },
        },
      ],
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
  },
  {
    timestamps: true,
  },
);

const ResumeModel = mongoose.model("Resume", resumeSchema);

module.exports = ResumeModel;
