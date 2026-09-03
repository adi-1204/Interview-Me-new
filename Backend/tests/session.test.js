const request = require("supertest");
const app = require("../src/app");
const { generateInterviewQuestion } = require("../src/services/ai.service");

describe("Session Service & Routes (Ticket 4)", () => {
  describe("POST /api/sessions — Auth protection", () => {
    it("should return 401 when no auth token is provided", async () => {
      const res = await request(app)
        .post("/api/sessions")
        .send({ resumeId: "dummy123" });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/token/i);
    });
  });

  describe("GET /api/sessions/:id/turns/:turnIndex/status — Auth protection", () => {
    it("should return 401 when no auth token is provided", async () => {
      const res = await request(app).get(
        "/api/sessions/650000000000000000000000/turns/1/status",
      );
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/token/i);
    });
  });

  describe("GET /api/sessions/:id/report — Auth protection", () => {
    it("should return 401 when no auth token is provided", async () => {
      const res = await request(app).get(
        "/api/sessions/650000000000000000000000/report",
      );
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/token/i);
    });
  });

  describe("POST /api/sessions/:id/end — Auth protection", () => {
    it("should return 401 when no auth token is provided", async () => {
      const res = await request(app).post(
        "/api/sessions/650000000000000000000000/end",
      );
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/token/i);
    });
  });
});
