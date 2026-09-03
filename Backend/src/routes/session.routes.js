const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const sessionController = require("../controllers/session.controller");

const sessionRouter = express.Router();

/**
 * @route POST /api/sessions
 * @description Create a new live interview session and generate Turn #1.
 * @access Private
 */
const upload = require("../middlewares/file.middleware");

sessionRouter.post(
  "/",
  authMiddleware.authUser,
  sessionController.createSessionController,
);

/**
 * @route GET /api/sessions/:id
 * @description Get session details by ID.
 * @access Private
 */
sessionRouter.get(
  "/:id",
  authMiddleware.authUser,
  sessionController.getSessionByIdController,
);

/**
 * @route POST /api/sessions/:id/turns/:turnIndex/response
 * @description Upload recorded audio/video answer for a turn.
 * @access Private
 */
sessionRouter.post(
  "/:id/turns/:turnIndex/response",
  authMiddleware.authUser,
  upload.single("recording"),
  sessionController.uploadRecordingController,
);

/**
 * @route GET /api/sessions/:id/turns/:turnIndex/status
 * @description Poll status of a turn response and retrieve or generate next question adaptively.
 * @access Private
 */
sessionRouter.get(
  "/:id/turns/:turnIndex/status",
  authMiddleware.authUser,
  sessionController.getTurnStatusController,
);

/**
 * @route GET /api/sessions/:id/report
 * @description Fetch full interview session report.
 * @access Private
 */
sessionRouter.get(
  "/:id/report",
  authMiddleware.authUser,
  sessionController.getSessionReportController,
);

/**
 * @route POST /api/sessions/:id/end
 * @description Manually end session and generate report based on answered turns.
 * @access Private
 */
sessionRouter.post(
  "/:id/end",
  authMiddleware.authUser,
  sessionController.endSessionController,
);

module.exports = sessionRouter;
