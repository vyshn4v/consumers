const { z } = require("zod");

/**
 * AI RESPONSE SCHEMA (ZOD)
 */
const AiSummarySchema = z.object({
  executive_summary: z.string(),
  risk_assessment: z.string(),
  exposed_services: z.array(z.string()),
  recommendations: z.array(z.string()),
  risk_score: z.number(),
});

/**
 * AI RESPONSE SCHEMA (JSON Schema)
 */
const responseSchema = {
  type: "object",
  properties: {
    executive_summary: {
      type: "string",
    },
    risk_assessment: {
      type: "string",
    },
    exposed_services: {
      type: "array",
      items: {
        type: "string",
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "string",
      },
    },
    risk_score: {
      type: "number",
    },
  },
  required: [
    "executive_summary",
    "risk_assessment",
    "exposed_services",
    "recommendations",
    "risk_score",
  ],
};

module.exports = {
  AiSummarySchema,
  responseSchema,
};
