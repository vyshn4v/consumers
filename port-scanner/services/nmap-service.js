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
 * SCAN MODE PRESETS
 * Maps a friendly preset name to the actual nmap arguments.
 * The consumer is the only layer that knows about nmap flags.
 */
const SCAN_PRESETS = {
  quick:         ["--top-ports", "100"],
  standard:      ["--top-ports", "1000"],         // default
  full:          ["-p-"],                          // all 65535 ports
  aggressive:    ["-A", "-p-"],                    // OS detection + scripts + version + traceroute
  vulnerability: ["--script", "vuln", "-p-"],      // NSE vulnerability scripts on all ports
};

/**
 * BUILD NMAP ARGS
 * Resolves a scanMode preset name into the final nmap argument array.
 * Falls back to 'standard' if the mode is unknown.
 */
function buildNmapArgs(domain, scanMode) {
  const preset = SCAN_PRESETS[scanMode] || SCAN_PRESETS.standard;

  if (!SCAN_PRESETS[scanMode]) {
    console.warn(`[nmap-service] Unknown scanMode '${scanMode}', falling back to 'standard'.`);
  }

  const baseArgs = ["-sV", "-Pn", "-T4"];

  // Merge base args with preset, avoiding duplicate flags
  const combinedArgs = [];
  for (const arg of baseArgs) {
    if (!preset.includes(arg)) {
      combinedArgs.push(arg);
    }
  }
  combinedArgs.push(...preset);

  console.log(`[nmap-service] scanMode='${scanMode || "standard"}' → nmap`, [...combinedArgs, "-oX", "-", domain].join(" "));

  return [...combinedArgs, "-oX", "-", domain];
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
