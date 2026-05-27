const { z } = require("zod");
const { GoogleGenAI } = require("@google/genai");
const { generateWithFallback } = require("../../shared/ai-helper");

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
  exposed_services: z.array(z.string()),
  recommendations: z.array(z.string()),
  risk_score: z.number(),
  graph_data: z.object({
    service_risk_chart: z.array(
      z.object({
        service: z.string(),
        risk_score: z.number(),
        count: z.number().optional(),
      }),
    ),
    risk_trend: z.array(
      z.object({
        time: z.string(),
        risk_level: z.number(),
      }),
    ),
    attack_surface: z.object({
      total_ports: z.number(),
      open_ports: z.number(),
      closed_ports: z.number(),
      filtered_ports: z.number(),
      risky_ports: z.number(),
    }),
  }),
});

/**
 * GEMINI AI SUMMARY
 */
async function generateSummary(scanData) {
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
      graph_data: {
        type: "object",
        additionalProperties: false,
        properties: {
          service_risk_chart: {
            type: "array",
            items: {
              type: "object",
              properties: {
                service: { type: "string" },
                risk_score: { type: "number" },
                count: { type: "number" },
              },
              required: ["service", "risk_score"],
            },
          },
          risk_trend: {
            type: "array",
            items: {
              type: "object",
              properties: {
                time: { type: "string" },
                risk_level: { type: "number" },
              },
              required: ["time", "risk_level"],
            },
          },
          attack_surface: {
            type: "object",
            properties: {
              total_ports: { type: "number" },
              open_ports: { type: "number" },
              closed_ports: { type: "number" },
              filtered_ports: { type: "number" },
              risky_ports: { type: "number" },
            },
            required: [
              "total_ports",
              "open_ports",
              "closed_ports",
              "filtered_ports",
              "risky_ports",
            ],
          },
        },
        required: ["service_risk_chart", "risk_trend", "attack_surface"],
      },
    },
    required: [
      "executive_summary",
      "risk_assessment",
      "exposed_services",
      "recommendations",
      "risk_score",
      "graph_data",
    ],
  };

  const prompt = `
You are a senior cybersecurity analyst.

Analyze this reconnaissance result with an advanced risk focus.

IMPORTANT:
Return ONLY valid JSON matching the provided schema.
Do not include extra graph arrays or unrelated data.

graph_data must include:
- service_risk_chart: advanced risk score for each exposed service
- risk_trend: time-series scan risk profile
- attack_surface: summary of total, open, closed, filtered, and risky ports

Requirements:
- executive_summary should explain the exposure and risk posture clearly
- risk_assessment should describe overall security severity
- exposed_services must list the most exposed risky services
- recommendations must provide strong remediation actions
- risk_score must be a number between 0-100

Focus:
- prioritize dangerous services and their likelihood of exploitation
- show whether the scan risk is rising, stable, or dropping over time
- avoid introducing secondary charts like protocol distribution or port version grids

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
