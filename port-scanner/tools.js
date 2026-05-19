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
  const baselineRisk = Math.min(
    100,
    openPorts.length * 7 + severity.high * 8 + severity.critical * 15,
  );

  const riskTrend = [
    { time: "00:00", risk_level: Math.max(15, baselineRisk - 24) },
    { time: "04:00", risk_level: Math.max(18, baselineRisk - 18) },
    { time: "08:00", risk_level: Math.max(24, baselineRisk - 12) },
    { time: "12:00", risk_level: Math.max(32, baselineRisk - 8) },
    { time: "16:00", risk_level: Math.max(40, baselineRisk - 4) },
    { time: "20:00", risk_level: baselineRisk },
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

    service_risk_chart: Object.entries(serviceMap)
      .map(([service, count]) => {
        const name = String(service || "unknown");
        const normalized = name.toLowerCase();
        let base = 40;

        if (/(ssh|22)/.test(normalized)) {
          base = 85;
        } else if (/(rdp|3389)/.test(normalized)) {
          base = 95;
        } else if (/(mysql|postgres|mariadb|3306|5432)/.test(normalized)) {
          base = 80;
        } else if (/(http|https|web|80|443|8080|8443)/.test(normalized)) {
          base = 55;
        } else if (/(smtp|ftp|telnet|snmp)/.test(normalized)) {
          base = 75;
        }

        return {
          service: name,
          count,
          risk_score: Math.min(100, base + count * 10),
        };
      })
      .sort((a, b) => b.risk_score - a.risk_score),

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

  throw new Error("All Gemini models failed to generate a valid summary");
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
