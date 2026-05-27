const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { generateWithFallback } = require("../../shared/ai-helper");

/**
 * GEMINI CLIENT
 */
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const { AiSummarySchema, responseSchema } = require("./ai-schema");

/**
 * GEMINI AI SUMMARY
 */
async function generateSummary(scanData) {


  const prompt = `
You are a senior cybersecurity analyst focusing on DNS and SSL/TLS posture.

Analyze this domain reconnaissance result.

IMPORTANT:
Return ONLY valid JSON matching the provided schema.

Requirements:
- executive_summary should explain the domain's exposure and basic DNS/SSL setup clearly.
- risk_assessment should describe overall security severity based on missing records (like MX, TXT) or SSL issues.
- domain_insights must list the most important takeaways from the DNS and SSL configurations.
- recommendations must provide actionable steps to improve the domain's security (e.g., DNSSEC, SPF/DMARC if missing, SSL renewals).
- risk_score must be a number between 0-100 (lower is better, higher means more risk).

NO markdown.
NO explanations.
NO extra keys.

Scan Data:
${JSON.stringify(scanData, null, 2)}
`;

  return generateWithFallback(ai, prompt, responseSchema, AiSummarySchema);
}

module.exports = {
  generateSummary,
};
