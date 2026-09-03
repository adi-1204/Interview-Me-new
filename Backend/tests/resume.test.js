const request = require("supertest");
const app = require("../src/app");
const { extractResumeText } = require("../src/services/resumeService");

describe("Resume Service & Routes (Ticket 1 & 2)", () => {
  describe("extractResumeText unit logic", () => {
    it("should return empty string if buffer is empty or null", async () => {
      const text = await extractResumeText(null);
      expect(text).toBe("");
    });
  });

  describe("POST /api/resumes — Auth protection", () => {
    it("should return 401 when no auth token is provided", async () => {
      const res = await request(app).post("/api/resumes");
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/token/i);
    });
  });

  describe("POST /api/resumes/:id/structure — Auth protection", () => {
    it("should return 401 when no auth token is provided", async () => {
      const res = await request(app).post("/api/resumes/dummyid123/structure");
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/token/i);
    });
  });
});
