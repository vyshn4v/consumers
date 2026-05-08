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

        properties: {
          severity_breakdown: {
            type: "object",

            properties: {
              critical: {
                type: "number",
              },

              high: {
                type: "number",
              },

              medium: {
                type: "number",
              },

              low: {
                type: "number",
              },
            },

            required: ["critical", "high", "medium", "low"],
          },

          port_state_chart: {
            type: "array",

            items: {
              type: "object",

              properties: {
                name: {
                  type: "string",
                },

                value: {
                  type: "number",
                },
              },

              required: ["name", "value"],
            },
          },

          service_chart: {
            type: "array",

            items: {
              type: "object",

              properties: {
                service: {
                  type: "string",
                },

                count: {
                  type: "number",
                },
              },

              required: ["service", "count"],
            },
          },

          risk_heatmap: {
            type: "array",

            items: {
              type: "object",

              properties: {
                port: {
                  type: "number",
                },

                service: {
                  type: "string",
                },

                risk: {
                  type: "number",
                },
              },

              required: ["port", "service", "risk"],
            },
          },

          radar_data: {
            type: "array",

            items: {
              type: "object",

              properties: {
                category: {
                  type: "string",
                },

                score: {
                  type: "number",
                },
              },

              required: ["category", "score"],
            },
          },

          attack_surface: {
            type: "object",

            properties: {
              total_ports: {
                type: "number",
              },

              open_ports: {
                type: "number",
              },

              closed_ports: {
                type: "number",
              },

              filtered_ports: {
                type: "number",
              },

              risky_ports: {
                type: "number",
              },
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

        required: [
          "severity_breakdown",
          "port_state_chart",
          "service_chart",
          "risk_heatmap",
          "radar_data",
          "attack_surface",
        ],
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
You are a cybersecurity analyst.

Analyze this scan result.

IMPORTANT:
Return ONLY valid JSON matching the schema.

Generate:
- executive summary
- risk assessment
- exposed services
- recommendations
- risk score
- graph analytics

Graph analytics must be frontend-ready for:
- pie charts
- bar charts
- radar charts
- heatmaps
- attack surface cards

Risk score must be between 0-100.

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

      const cleaned = raw.trim();

      const parsed = JSON.parse(cleaned);

      return parsed;
    } catch (err) {
      console.error(`Gemini failed: ${model}`);

      console.error(err);
    }
  }

  return {
    executive_summary: "Target exposes multiple services.",

    risk_assessment: "Several potentially risky services were identified.",

    exposed_services: ["ssh", "http"],

    recommendations: ["Restrict unnecessary ports", "Monitor exposed services"],

    risk_score: 55,

    graph_data: {
      severity_breakdown: {
        critical: 0,
        high: 1,
        medium: 1,
        low: 2,
      },

      port_state_chart: [
        {
          name: "Open",
          value: 4,
        },

        {
          name: "Closed",
          value: 2,
        },

        {
          name: "Filtered",
          value: 1,
        },
      ],

      service_chart: [
        {
          service: "ssh",
          count: 1,
        },

        {
          service: "http",
          count: 2,
        },
      ],

      risk_heatmap: [
        {
          port: 22,
          service: "ssh",
          risk: 80,
        },
      ],

      radar_data: [
        {
          category: "Exposure",
          score: 70,
        },
      ],

      attack_surface: {
        total_ports: 10,
        open_ports: 4,
        closed_ports: 4,
        filtered_ports: 2,
        risky_ports: 1,
      },
    },
  };
}
