const dns = require("dns").promises;
const { isValidDomain, fetchSSLCertificate } = require("./ssl-service");
const { generateSummary } = require("./ai-service");

/**
 * MAIN API
 */
module.exports = async function scanner({ data }) {
  console.log("Scanner received:", data);

  try {
    const { domain } = data;

    if (!domain) {
      return { success: false, error: "Domain is required" };
    }

    if (!isValidDomain(domain)) {
      return { success: false, error: "Invalid domain" };
    }

    // 1. DNS Scanning
    const dnsRecords = {};
    const recordTypes = ["A", "AAAA", "MX", "TXT", "NS"];

    for (const type of recordTypes) {
      try {
        dnsRecords[type] = await dns.resolve(domain, type);
      } catch (err) {
        dnsRecords[type] = null; // Record not found or error
      }
    }

    // 2. SSL/TLS Scanning
    const sslDetails = await fetchSSLCertificate(domain);

    const parsedScan = {
      domain,
      dns_records: dnsRecords,
      ssl_certificate: sslDetails,
      timestamp: new Date().toISOString(),
    };

    // 3. AI Analysis
    const aiSummary = await generateSummary(parsedScan);

    return {
      success: true,
      scan_type: "domain",
      scan: parsedScan,
      ai_summary: aiSummary,
    };
  } catch (err) {
    console.error("Domain scan failed:", err);
    return {
      success: false,
      error: "Scan failed",
      message: err?.toString(),
    };
  }
};
