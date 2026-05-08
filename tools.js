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
  };
}

/**
 * GEMINI AI SUMMARY
 */

async function generateSummary(scanData) {
  const prompt = `
You are a cybersecurity analyst.

Analyze this reconnaissance result.

IMPORTANT:
Return ONLY valid JSON.

Use EXACTLY this schema:

{
  "executive_summary": "string",
  "risk_assessment": "string",
  "exposed_services": ["string"],
  "recommendations": ["string"],
  "risk_score": 0
}

Rules:
- risk_score must be number
- exposed_services must be string array
- recommendations must be string array
- no markdown
- no extra keys

Data:
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

module.exports = async function scanner(body) {
  console.log("Scanner received:", body);
  try {
    const { domain } = body;

    /**
     * VALIDATION
     */

    if (!domain) {
      return;
    }

    if (!isValidDomain(domain)) {
      return;
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

    /**
     * AI ANALYSIS
     */

    const aiSummary = await generateSummary({
      domain,
      ...parsedScan,
    });

    /**
     * FINAL STABLE RESPONSE
     */

    return {
      success: true,

      scan: {
        domain,

        ip: parsedScan.ip,

        status: parsedScan.status,

        ports: parsedScan.ports,
      },

      ai_summary: aiSummary,
    };
  } catch (err) {
    console.error(err);
    return;
  }
};
