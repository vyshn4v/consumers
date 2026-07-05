const { z } = require("zod");
const { GoogleGenAI } = require("@google/genai");
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
You are a senior cybersecurity analyst.

Analyze this reconnaissance result with an advanced risk focus.

IMPORTANT:
Return ONLY valid JSON matching the provided schema.

Requirements:
- executive_summary should explain the exposure and risk posture clearly
- risk_assessment should describe overall security severity
- exposed_services must list the most exposed risky services
- recommendations must provide strong remediation actions
- risk_score must be a number between 0-100

Focus:
- prioritize dangerous services and their likelihood of exploitation
- show whether the scan risk is rising, stable, or dropping over time

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
