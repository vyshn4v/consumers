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

    service_risk_chart: z.array(
      z.object({
        service: z.string(),
        risk_score: z.number(),
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

    vulnerability_timeline: z.array(
      z.object({
        date: z.string(),
        vulnerabilities: z.number(),
        risk_score: z.number(),
      }),
    ),

    protocol_distribution: z.array(
      z.object({
        protocol: z.string(),
        count: z.number(),
      }),
    ),

    port_range_distribution: z.array(
      z.object({
        range: z.string(),
        count: z.number(),
      }),
    ),

    service_version_chart: z.array(
      z.object({
        service: z.string(),
        version: z.string(),
        count: z.number(),
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

  /**
   * VULNERABILITY TIMELINE
   */
  const vulnerabilityTimeline = [
    {
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      vulnerabilities: Math.floor(openPorts.length * 0.3),
      risk_score: Math.min(100, openPorts.length * 5),
    },
    {
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      vulnerabilities: Math.floor(openPorts.length * 0.6),
      risk_score: Math.min(100, openPorts.length * 8),
    },
    {
      date: new Date().toISOString().split("T")[0],
      vulnerabilities: openPorts.length,
      risk_score: Math.min(100, openPorts.length * 10),
    },
  ];

  /**
   * PROTOCOL DISTRIBUTION
   */
  const protocolMap = {};
  for (const port of scan.ports) {
    const protocol = port.protocol || "unknown";
    if (!protocolMap[protocol]) {
      protocolMap[protocol] = 0;
    }
    protocolMap[protocol]++;
  }

  const protocolDistribution = Object.entries(protocolMap).map(
    ([protocol, count]) => ({
      protocol: protocol.toUpperCase(),
      count,
    }),
  );

  /**
   * PORT RANGE DISTRIBUTION
   */
  const portRanges = {
    "Well-known (1-1023)": 0,
    "Registered (1024-49151)": 0,
    "Dynamic (49152-65535)": 0,
  };

  for (const port of openPorts) {
    if (port.port <= 1023) {
      portRanges["Well-known (1-1023)"]++;
    } else if (port.port <= 49151) {
      portRanges["Registered (1024-49151)"]++;
    } else {
      portRanges["Dynamic (49152-65535)"]++;
    }
  }

  const portRangeDistribution = Object.entries(portRanges).map(
    ([range, count]) => ({
      range,
      count,
    }),
  );

  /**
   * SERVICE VERSION CHART
   */
  const versionMap = {};
  for (const port of openPorts) {
    const service = port.service || "unknown";
    const version = port.version || "unknown";
    const key = `${service} ${version}`;
    if (!versionMap[key]) {
      versionMap[key] = 0;
    }
    versionMap[key]++;
  }

  const serviceVersionChart = Object.entries(versionMap).map(
    ([serviceVersion, count]) => {
      const [service, ...versionParts] = serviceVersion.split(" ");
      const version = versionParts.join(" ") || "unknown";
      return {
        service,
        version,
        count,
      };
    },
  );

  /**
   * RISK TREND
   */
  const riskTrend = [
    { time: "00:00", risk_level: Math.floor(Math.random() * 30) + 20 },
    { time: "04:00", risk_level: Math.floor(Math.random() * 40) + 30 },
    { time: "08:00", risk_level: Math.floor(Math.random() * 50) + 40 },
    { time: "12:00", risk_level: Math.floor(Math.random() * 60) + 50 },
    { time: "16:00", risk_level: Math.floor(Math.random() * 70) + 60 },
    { time: "20:00", risk_level: Math.floor(Math.random() * 80) + 70 },
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

    service_risk_chart: Object.entries(serviceMap).map(([service, count]) => ({
      service,
      risk_score: Math.min(100, 15 + count * 20),
    })),

    risk_heatmap: riskHeatmap,

    radar_data: radarData,

    vulnerability_timeline: vulnerabilityTimeline,

    protocol_distribution: protocolDistribution,

    port_range_distribution: portRangeDistribution,

    service_version_chart: serviceVersionChart,

    risk_trend: riskTrend,

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

          service_risk_chart: {
            type: "array",

            items: {
              type: "object",

              properties: {
                service: { type: "string" },
                risk_score: { type: "number" },
              },

              required: ["service", "risk_score"],
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

          vulnerability_timeline: {
            type: "array",

            items: {
              type: "object",

              properties: {
                date: { type: "string" },
                vulnerabilities: { type: "number" },
                risk_score: { type: "number" },
              },

              required: ["date", "vulnerabilities", "risk_score"],
            },
          },

          protocol_distribution: {
            type: "array",

            items: {
              type: "object",

              properties: {
                protocol: { type: "string" },
                count: { type: "number" },
              },

              required: ["protocol", "count"],
            },
          },

          port_range_distribution: {
            type: "array",

            items: {
              type: "object",

              properties: {
                range: { type: "string" },
                count: { type: "number" },
              },

              required: ["range", "count"],
            },
          },

          service_version_chart: {
            type: "array",

            items: {
              type: "object",

              properties: {
                service: { type: "string" },
                version: { type: "string" },
                count: { type: "number" },
              },

              required: ["service", "version", "count"],
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

        required: [
          "severity_breakdown",
          "port_state_chart",
          "service_chart",
          "service_risk_chart",
          "risk_heatmap",
          "radar_data",
          "vulnerability_timeline",
          "protocol_distribution",
          "port_range_distribution",
          "service_version_chart",
          "risk_trend",
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
- service risk chart
- heatmap
- radar chart
- vulnerability timeline (historical vulnerability data)
- protocol distribution (TCP/UDP breakdown)
- port range distribution (well-known, registered, dynamic ports)
- service version chart (service versions and counts)
- risk trend (time-based risk levels)
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

For new graphs:
- vulnerability_timeline: Generate realistic historical data points
- protocol_distribution: Count TCP vs UDP protocols
- port_range_distribution: Categorize ports by IANA ranges
- service_version_chart: Include detected service versions
- risk_trend: Generate time-series risk data

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
