const {
  transcribeRecording,
  analyzeSpeechDelivery,
  analyzeBodyLanguage,
  analyzeResponse,
} = require("../src/services/interviewAnalysis.service");
const { evaluateStarMethod } = require("../src/services/ai.service");

describe("Interview Analysis Service (Tickets 8, 9, 10, 11)", () => {
  describe("Ticket 8 — Real Speech Transcription", () => {
    it("should handle non-existent recording URL gracefully without crashing", async () => {
      const result = await analyzeResponse("/uploads/recordings/non_existent_file.webm", "behavioral");
      expect(result).toHaveProperty("transcript");
      expect(result.transcript).toMatch(/not found/i);
      expect(result).toHaveProperty("communicationScore", 50);
      expect(result).toHaveProperty("bodyLanguageScore", null);
      expect(result).toHaveProperty("starBreakdown");
    });

    it("transcribeRecording should return fallback message when file path is invalid", async () => {
      const transcript = await transcribeRecording(null);
      expect(transcript).toBe("Audio file not found for transcription.");
    });
  });

  describe("Ticket 9 — Speech Delivery Analysis", () => {
    it("should award high score for clear speech within optimal 120-160 WPM range and zero fillers", () => {
      const words = Array(140).fill("confident").join(" ");
      const metrics = analyzeSpeechDelivery(words, 60);

      expect(metrics.wordsPerMinute).toBe(140);
      expect(metrics.fillerCount).toBe(0);
      expect(metrics.communicationScore).toBe(100);
    });

    it("should penalize score for filler-heavy and rushed/slow transcripts", () => {
      const fillerText =
        "Um, like, basically, you know, I mean, we actually had to, like, fix the database, um, so right, it was like, really hard, you know, basically.";
      const metrics = analyzeSpeechDelivery(fillerText, 60);

      expect(metrics.fillerCount).toBeGreaterThan(5);
      expect(metrics.communicationScore).toBeLessThan(80);
    });
  });

  describe("Ticket 10 — Body Language Analysis", () => {
    it("should return bodyLanguageScore: null for audio-only file paths", async () => {
      const result = await analyzeBodyLanguage("/uploads/recordings/audio_response.mp3");
      expect(result.bodyLanguageScore).toBeNull();
      expect(result.feedback).toMatch(/Audio-only/i);
    });

    it("should return bodyLanguageScore: null when file path does not exist", async () => {
      const result = await analyzeBodyLanguage(null);
      expect(result.bodyLanguageScore).toBeNull();
    });
  });

  describe("Ticket 11 — STAR Method Evaluation", () => {
    it("should return starBreakdown: null for technical question types", async () => {
      const result = await analyzeResponse("/uploads/recordings/tech_test.webm", "technical");
      expect(result.starBreakdown).toBeNull();
    });

    it("should return false booleans for empty or fallback transcripts", async () => {
      const star = await evaluateStarMethod(null);
      expect(star.situation).toBe(false);
      expect(star.task).toBe(false);
      expect(star.action).toBe(false);
      expect(star.result).toBe(false);
      expect(star.feedback).toMatch(/empty/i);
    });
  });
});
