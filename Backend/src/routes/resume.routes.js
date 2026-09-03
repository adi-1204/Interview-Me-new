const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const upload = require("../middlewares/file.middleware");
const resumeController = require("../controllers/resume.controller");

const resumeRouter = express.Router();

/**
 * @route POST /api/resumes
 * @description Upload and parse a resume for session use.
 * @access Private
 */
resumeRouter.post(
  "/",
  authMiddleware.authUser,
  upload.single("resume"),
  resumeController.uploadResumeController,
);

/**
 * @route POST /api/resumes/:id/structure
 * @description Structure raw resume text into skills, projects, and experience using Gemini LLM.
 * @access Private
 */
resumeRouter.post(
  "/:id/structure",
  authMiddleware.authUser,
  resumeController.structureResumeController,
);

/**
 * @route GET /api/resumes/:id
 * @description Get resume by ID.
 * @access Private
 */
resumeRouter.get(
  "/:id",
  authMiddleware.authUser,
  resumeController.getResumeByIdController,
);

/**
 * @route PATCH /api/resumes/:id
 * @description Save user edits to structured resume data.
 * @access Private
 */
resumeRouter.patch(
  "/:id",
  authMiddleware.authUser,
  resumeController.updateResumeController,
);

module.exports = resumeRouter;
