const ResumeModel = require("../models/resume.model");
const { extractResumeText } = require("../services/resumeService");
const { structureResume } = require("../services/ai.service");

/**
 * @description Upload and parse a resume PDF for session use
 * @route POST /api/resumes
 * @access Private
 */
async function uploadResumeController(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a resume PDF file.",
      });
    }

    const isPdfMime = req.file.mimetype === "application/pdf";
    const isPdfByName =
      typeof req.file.originalname === "string" &&
      req.file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdfMime && !isPdfByName) {
      return res.status(400).json({
        message: "Only PDF resumes are supported right now.",
      });
    }

    const rawText = await extractResumeText(req.file.buffer);

    if (!rawText || rawText.trim().length < 20) {
      return res.status(400).json({
        message:
          "Could not extract readable text from the uploaded PDF. Please make sure it is not a scanned or image-only PDF.",
      });
    }

    const targetRole = req.body.targetRole?.trim() || "";
    const targetDomain = req.body.targetDomain?.trim() || "";
    const companyStyle = req.body.companyStyle?.trim() || "";

    const resumeDoc = await ResumeModel.create({
      user: req.user.id,
      rawText,
      targetRole,
      targetDomain,
      companyStyle,
    });

    return res.status(201).json({
      message: "Resume uploaded and parsed successfully.",
      resumeId: resumeDoc._id,
      textLength: rawText.length,
      targetRole: resumeDoc.targetRole,
      targetDomain: resumeDoc.targetDomain,
      companyStyle: resumeDoc.companyStyle,
    });
  } catch (error) {
    console.error("Failed to upload and parse resume:", error);
    return res.status(500).json({
      message: "Failed to process resume. Please try again.",
    });
  }
}

/**
 * @description Generate structured skills, projects, and experience from a resume
 * @route POST /api/resumes/:id/structure
 * @access Private
 */
async function structureResumeController(req, res) {
  try {
    const { id } = req.params;
    const resumeDoc = await ResumeModel.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!resumeDoc) {
      return res.status(404).json({
        message: "Resume not found.",
      });
    }

    if (
      resumeDoc.structuredData &&
      (resumeDoc.structuredData.skills?.length > 0 ||
        resumeDoc.structuredData.projects?.length > 0 ||
        resumeDoc.structuredData.experience?.length > 0) &&
      req.query.force !== "true"
    ) {
      return res.status(200).json({
        message: "Structured resume data retrieved.",
        structuredData: resumeDoc.structuredData,
      });
    }

    const structuredData = await structureResume(resumeDoc.rawText);

    resumeDoc.structuredData = structuredData;
    await resumeDoc.save();

    return res.status(200).json({
      message: "Resume structured successfully.",
      structuredData: resumeDoc.structuredData,
    });
  } catch (error) {
    console.error("Failed to structure resume:", error);

    if (error?.name === "ZodError") {
      return res.status(400).json({
        message: "Extracted resume data failed schema validation.",
        details: error.errors,
      });
    }

    if (error?.code === "MISSING_AI_API_KEY") {
      return res.status(500).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: error.message || "Failed to structure resume data.",
    });
  }
}

/**
 * @description Get a single resume document by ID
 * @route GET /api/resumes/:id
 * @access Private
 */
async function getResumeByIdController(req, res) {
  try {
    const { id } = req.params;
    const resumeDoc = await ResumeModel.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!resumeDoc) {
      return res.status(404).json({
        message: "Resume not found.",
      });
    }

    return res.status(200).json({
      message: "Resume retrieved successfully.",
      resume: resumeDoc,
    });
  } catch (error) {
    console.error("Failed to fetch resume:", error);
    return res.status(500).json({
      message: "Failed to fetch resume.",
    });
  }
}

/**
 * @description Save user edits to structured resume data
 * @route PATCH /api/resumes/:id
 * @access Private
 */
async function updateResumeController(req, res) {
  try {
    const { id } = req.params;
    const resumeDoc = await ResumeModel.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!resumeDoc) {
      return res.status(404).json({
        message: "Resume not found.",
      });
    }

    const { structuredData, targetRole, targetDomain, companyStyle } = req.body;

    if (structuredData !== undefined) {
      resumeDoc.structuredData = structuredData;
    }

    if (targetRole !== undefined) {
      resumeDoc.targetRole = targetRole.trim();
    }

    if (targetDomain !== undefined) {
      resumeDoc.targetDomain = targetDomain.trim();
    }

    if (companyStyle !== undefined) {
      resumeDoc.companyStyle = companyStyle.trim();
    }

    await resumeDoc.save();

    return res.status(200).json({
      message: "Resume updated successfully.",
      resume: resumeDoc,
    });
  } catch (error) {
    console.error("Failed to update resume:", error);
    return res.status(500).json({
      message: "Failed to update resume.",
    });
  }
}

module.exports = {
  uploadResumeController,
  structureResumeController,
  getResumeByIdController,
  updateResumeController,
};
