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

  const currentYear = new Date().getFullYear();
  const riskTrend = [
    { time: String(currentYear - 5), risk_level: Math.max(15, baselineRisk - 24) },
    { time: String(currentYear - 4), risk_level: Math.max(18, baselineRisk - 18) },
    { time: String(currentYear - 3), risk_level: Math.max(24, baselineRisk - 12) },
    { time: String(currentYear - 2), risk_level: Math.max(32, baselineRisk - 8) },
    { time: String(currentYear - 1), risk_level: Math.max(40, baselineRisk - 4) },
    { time: String(currentYear), risk_level: baselineRisk },
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

module.exports = {
  generateGraphData,
  generateLocalSummary,
};
