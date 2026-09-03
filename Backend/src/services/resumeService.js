const { extractPdfTextFromBuffer } = require("./rag.service");

/**
 * Extracts raw text from a PDF resume file buffer.
 * @param {Buffer} fileBuffer - The PDF file buffer
 * @returns {Promise<string>} Extracted text string
 */
async function extractResumeText(fileBuffer) {
  if (!fileBuffer) {
    return "";
  }
  const text = await extractPdfTextFromBuffer(fileBuffer);
  return text ? text.trim() : "";
}

module.exports = {
  extractResumeText,
};
