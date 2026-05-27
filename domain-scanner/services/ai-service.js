const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");

/**
 * GEMINI CLIENT
 */
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * AI RESPONSE SCHEMA
 */
const AiSummarySchema = z.object({
  executive_summary: z.string(),
  risk_assessment: z.string(),
  domain_insights: z.array(z.string()),
  recommendations: z.array(z.string()),
  risk_score: z.number(),
});

/**
 * GEMINI AI SUMMARY
 */
async function generateSummary(scanData) {
  const responseSchema = {
    type: "object",
    properties: {
      executive_summary: { type: "string" },
      risk_assessment: { type: "string" },
      domain_insights: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      risk_score: { type: "number" },
    },
    required: [
      "executive_summary",
      "risk_assessment",
      "domain_insights",
      "recommendations",
      "risk_score",
    ],
  };

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

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const raw = response.text;
      const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      const validated = AiSummarySchema.parse(parsed);

      return validated;
    } catch (err) {
      console.error(`Gemini model failed: ${model}`, err.message);
    }
  }

  throw new Error("All Gemini models failed to generate a valid summary");
}

module.exports = {
  generateSummary,
};
