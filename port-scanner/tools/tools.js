const {
  isValidDomain,
  buildNmapArgs,
  executeCommand,
  parseNmapXml,
} = require("../services/nmap-service");
const { generateSummary } = require("../services/ai-service");
const { generateLocalSummary } = require("../services/graph-service");

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
    const scanMode = data.data?.scanMode || data.scanMode || "standard";
    const nmapArgs = buildNmapArgs(domain, scanMode);
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

    // If Gemini fails, we could fallback to local summary
    // Since the original code threw an error from generateSummary, we'll return error here
    return {
      success: false,
      error: "Scan failed",
      message: err?.toString(),
    };
  }
};
