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

module.exports = {
  AiSummarySchema,
  responseSchema,
};
