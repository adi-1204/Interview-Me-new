import axios from "axios";

const normalizedApiUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: normalizedApiUrl,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

/**
 * Upload resume PDF for session use
 */
export const uploadSessionResume = async ({
  resumeFile,
  targetRole,
  targetDomain,
  companyStyle,
}) => {
  const formData = new FormData();
  if (resumeFile) {
    formData.append("resume", resumeFile);
  }
  if (targetRole) formData.append("targetRole", targetRole);
  if (targetDomain) formData.append("targetDomain", targetDomain);
  if (companyStyle) formData.append("companyStyle", companyStyle);

  const response = await api.post("/api/resumes", formData);
  return response.data;
};

/**
 * Fetch resume document by ID
 */
export const getResumeById = async (resumeId) => {
  const response = await api.get(`/api/resumes/${resumeId}`);
  return response.data;
};

/**
 * Call LLM structuring endpoint for a resume
 */
export const structureResumeData = async (resumeId, { force = false } = {}) => {
  const response = await api.post(
    `/api/resumes/${resumeId}/structure${force ? "?force=true" : ""}`,
  );
  return response.data;
};

/**
 * Save user edits to structured resume data via PATCH
 */
export const updateResumeData = async (
  resumeId,
  { structuredData, targetRole, targetDomain, companyStyle },
) => {
  const response = await api.patch(`/api/resumes/${resumeId}`, {
    structuredData,
    targetRole,
    targetDomain,
    companyStyle,
  });
  return response.data;
};

/**
 * Create a new live interview session and generate question #1
 */
export const createSession = async ({ resumeId }) => {
  const response = await api.post("/api/sessions", { resumeId });
  return response.data;
};

/**
 * Fetch session details by ID
 */
export const getSessionById = async (sessionId) => {
  const response = await api.get(`/api/sessions/${sessionId}`);
  return response.data;
};

/**
 * Upload recording response for a session turn
 */
export const uploadTurnResponse = async ({
  sessionId,
  turnIndex,
  recordingBlob,
}) => {
  const formData = new FormData();
  const fileExt = recordingBlob.type?.includes("video") ? ".webm" : ".webm";
  formData.append(
    "recording",
    recordingBlob,
    `recording_turn_${turnIndex}${fileExt}`,
  );

  const response = await api.post(
    `/api/sessions/${sessionId}/turns/${turnIndex}/response`,
    formData,
  );
  return response.data;
};

/**
 * Poll turn status and adaptively generate or fetch next question
 */
export const pollTurnStatus = async ({ sessionId, turnIndex }) => {
  const response = await api.get(
    `/api/sessions/${sessionId}/turns/${turnIndex}/status`,
  );
  return response.data;
};

/**
 * Fetch complete session report with aggregated scores and actionable feedback
 */
export const getSessionReport = async (sessionId) => {
  const response = await api.get(`/api/sessions/${sessionId}/report`);
  return response.data;
};

/**
 * End interview session manually and calculate report on answered questions
 */
export const endSession = async (sessionId) => {
  const response = await api.post(`/api/sessions/${sessionId}/end`);
  return response.data;
};
