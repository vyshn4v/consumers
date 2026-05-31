const { z } = require("zod");

/**
 * AI RESPONSE SCHEMA (ZOD)
 */
const AiSummarySchema = z.object({
  executive_summary: z.string(),
  risk_assessment: z.string(),
  domain_insights: z.array(z.string()),
  recommendations: z.array(z.string()),
  risk_score: z.number(),
});

/**
 * AI RESPONSE SCHEMA (JSON Schema)
 */
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

module.exports = {
  AiSummarySchema,
  responseSchema,
};
