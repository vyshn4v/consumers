const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const xml2js = require("xml2js");
const { z } = require("zod");

const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json());

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
    severity_breakdown: z.object({
      critical: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number(),
    }),

    port_state_chart: z.array(
      z.object({
        name: z.string(),
        value: z.number(),
      }),
    ),

    service_chart: z.array(
      z.object({
        service: z.string(),
        count: z.number(),
      }),
    ),

    risk_heatmap: z.array(
      z.object({
        port: z.number(),
        service: z.string(),
        risk: z.number(),
      }),
    ),

    radar_data: z.array(
      z.object({
        category: z.string(),
        score: z.number(),
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
 * DOMAIN VALIDATION
 */

function isValidDomain(domain) {
  const regex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  return regex.test(domain);
}

/**
 * BUILD NMAP ARGS
 */

function buildNmapArgs(domain) {
  return ["-sV", "-Pn", "-T4", "-oX", "-", domain];
}

/**
 * EXECUTE COMMAND
 */

function executeCommand(tool, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(tool, args);

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(errorOutput);
      }

      resolve(output);
    });
  });
}

/**
 * PARSE NMAP XML
 */

async function parseNmapXml(xml) {
  const parser = new xml2js.Parser();

  const result = await parser.parseStringPromise(xml);

  const host = result.nmaprun.host?.[0];

  if (!host) {
    return null;
  }

  const ip = host.address?.[0]?.$.addr || null;

  const status = host.status?.[0]?.$.state || null;

  const ports = host.ports?.[0]?.port || [];

  const parsedPorts = ports.map((p) => {
    return {
      port: Number(p.$.portid),

      protocol: p.$.protocol,

      state: p.state?.[0]?.$.state || null,

      service: p.service?.[0]?.$.name || null,

      product: p.service?.[0]?.$.product || null,

      version: p.service?.[0]?.$.version || null,
    };
  });

  return {
    ip,
    status,
    ports: parsedPorts,
  };
}

/**
 * GENERATE GRAPH DATA
 */

function generateGraphData(scan) {
  const openPorts = scan.ports.filter((p) => p.state === "open");

  const closedPorts = scan.ports.filter((p) => p.state === "closed");

  const filteredPorts = scan.ports.filter((p) => p.state === "filtered");

  /**
   * SERVICE COUNT
   */

  const serviceMap = {};

  for (const port of openPorts) {
    const service = port.service || "unknown";

    if (!serviceMap[service]) {
      serviceMap[service] = 0;
    }

    serviceMap[service]++;
  }

  const serviceChart = Object.entries(serviceMap).map(([service, count]) => ({
    service,
    count,
  }));

  /**
   * RISKY PORTS
   */

  const riskyPorts = [21, 22, 23, 25, 3389, 3306, 5432];

  const riskHeatmap = openPorts.map((p) => {
    let risk = 30;

    if (riskyPorts.includes(p.port)) {
      risk = 85;
    }

    if (p.port === 3389) {
      risk = 95;
    }

    return {
      port: p.port,
      service: p.service,
      risk,
    };
  });

  /**
   * SEVERITY
   */

  const severity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const p of openPorts) {
    if (p.port === 3389) {
      severity.critical++;
    } else if ([22, 21, 23].includes(p.port)) {
      severity.high++;
    } else if ([3306, 5432].includes(p.port)) {
      severity.medium++;
    } else {
      severity.low++;
    }
  }

  /**
   * RADAR DATA
   */

  const radarData = [
    {
      category: "Exposure",
      score: Math.min(openPorts.length * 10, 100),
    },
    {
      category: "Remote Access",
      score: openPorts.some((p) => [22, 23, 3389].includes(p.port)) ? 90 : 20,
    },
    {
      category: "Database",
      score: openPorts.some((p) => [3306, 5432].includes(p.port)) ? 75 : 10,
    },
    {
      category: "Web Services",
      score: openPorts.some((p) => [80, 443, 8080, 8443].includes(p.port))
        ? 60
        : 15,
    },
  ];

  return {
    severity_breakdown: severity,

    port_state_chart: [
      {
        name: "Open",
        value: openPorts.length,
      },
      {
        name: "Closed",
        value: closedPorts.length,
      },
      {
        name: "Filtered",
        value: filteredPorts.length,
      },
    ],

    service_chart: serviceChart,

    risk_heatmap: riskHeatmap,

    radar_data: radarData,

    attack_surface: {
      total_ports: scan.ports.length,

      open_ports: openPorts.length,

      closed_ports: closedPorts.length,

      filtered_ports: filteredPorts.length,

      risky_ports: openPorts.filter((p) => riskyPorts.includes(p.port)).length,
    },
  };
}

/**
 * LOCAL FALLBACK SUMMARY
 */

function generateLocalSummary(scan) {
  const openPorts = scan.ports
    .filter((p) => p.state === "open")
    .map((p) => String(p.port));

  let riskScore = 10;

  if (openPorts.includes("22")) {
    riskScore += 15;
  }

  if (openPorts.includes("3389")) {
    riskScore += 40;
  }

  if (openPorts.includes("8443")) {
    riskScore += 10;
  }

  return {
    executive_summary: "Target exposes multiple network services.",

    risk_assessment: "Cloud/web-related services detected.",

    exposed_services: openPorts,

    recommendations: [
      "Review exposed services",
      "Close unnecessary ports",
      "Monitor administrative endpoints",
    ],

    risk_score: riskScore,

    graph_data: generateGraphData(scan),
  };
}

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

        properties: {
          severity_breakdown: {
            type: "object",

            properties: {
              critical: { type: "number" },
              high: { type: "number" },
              medium: { type: "number" },
              low: { type: "number" },
            },

            required: ["critical", "high", "medium", "low"],
          },

          port_state_chart: {
            type: "array",

            items: {
              type: "object",

              properties: {
                name: { type: "string" },
                value: { type: "number" },
              },

              required: ["name", "value"],
            },
          },

          service_chart: {
            type: "array",

            items: {
              type: "object",

              properties: {
                service: { type: "string" },
                count: { type: "number" },
              },

              required: ["service", "count"],
            },
          },

          risk_heatmap: {
            type: "array",

            items: {
              type: "object",

              properties: {
                port: { type: "number" },
                service: { type: "string" },
                risk: { type: "number" },
              },

              required: ["port", "service", "risk"],
            },
          },

          radar_data: {
            type: "array",

            items: {
              type: "object",

              properties: {
                category: { type: "string" },
                score: { type: "number" },
              },

              required: ["category", "score"],
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
You are a senior cybersecurity analyst.

Analyze this reconnaissance result.

IMPORTANT:
Return ONLY valid JSON matching the provided schema.

Generate frontend-ready dashboard analytics.

graph_data must include:
- severity breakdown
- service chart
- heatmap
- radar chart
- attack surface metrics
- chart-compatible arrays

Requirements:
- executive_summary should explain the exposure briefly
- risk_assessment should explain the overall security posture
- exposed_services must contain detected risky/exposed services
- recommendations must provide remediation suggestions
- risk_score must be a number between 0-100

Risk Guidelines:
- RDP (3389) = critical
- SSH (22) = medium/high
- Database services = medium
- Multiple exposed services increase risk
- Administrative services increase risk

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

      /**
       * CLEAN OUTPUT
       */

      const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      /**
       * PARSE JSON
       */

      const parsed = JSON.parse(cleaned);

      /**
       * VALIDATE STRUCTURE
       */

      const validated = AiSummarySchema.parse(parsed);

      return validated;
    } catch (err) {
      console.error(`Gemini model failed: ${model}`);

      console.error(err);
    }
  }

  /**
   * FALLBACK
   */

  return generateLocalSummary(scanData);
}

/**
 * MAIN API
 */

module.exports = async function scanner({ data }) {
  console.log("Scanner received:", data);

  try {
    const { domain } = data;

    /**
     * VALIDATION
     */

    if (!domain) {
      return {
        success: false,
        error: "Domain is required",
      };
    }

    if (!isValidDomain(domain)) {
      return {
        success: false,
        error: "Invalid domain",
      };
    }

    /**
     * RUN NMAP
     */

    const nmapArgs = buildNmapArgs(domain);

    const xmlResult = await executeCommand("nmap", nmapArgs);

    /**
     * PARSE XML
     */

    const parsedScan = await parseNmapXml(xmlResult);

    if (!parsedScan) {
      return {
        success: false,
        error: "Failed to parse scan",
      };
    }

    /**
     * AI ANALYSIS
     */

    const aiSummary = await generateSummary({
      domain,
      ...parsedScan,
    });

    /**
     * FINAL RESPONSE
     */

    return {
      success: true,

      scan: {
        domain,

        ip: parsedScan.ip,

        status: parsedScan.status,

        ports: parsedScan.ports,
      },

      ai_summary: {
        executive_summary: aiSummary.executive_summary,

        risk_assessment: aiSummary.risk_assessment,

        exposed_services: aiSummary.exposed_services,

        recommendations: aiSummary.recommendations,

        risk_score: aiSummary.risk_score,
      },

      graph_data: aiSummary.graph_data,
    };
  } catch (err) {
    console.error(err);

    return {
      success: false,
      error: "Scan failed",
      message: err?.toString(),
    };
  }
};
