const { spawn } = require("child_process");
const xml2js = require("xml2js");

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
function buildNmapArgs(domain, options) {
  let customArgs = [];
  if (options) {
    if (Array.isArray(options)) {
      customArgs = options;
    } else if (typeof options === "string") {
      customArgs = options.split(/\s+/).filter(Boolean);
    }
  }

  const baseArgs = ["-sV", "-Pn", "-T4"];
  return [...baseArgs, ...customArgs, "-oX", "-", domain];
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

module.exports = {
  isValidDomain,
  buildNmapArgs,
  executeCommand,
  parseNmapXml,
};
