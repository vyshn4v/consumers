const tls = require("tls");

/**
 * DOMAIN VALIDATION
 */
function isValidDomain(domain) {
  const regex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(domain);
}

/**
 * FETCH SSL CERTIFICATE
 */
function fetchSSLCertificate(domain) {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        443,
        domain,
        {
          servername: domain,
          rejectUnauthorized: false,
          timeout: 5000,
        },
        () => {
          const cert = socket.getPeerCertificate();
          socket.end();

          if (!cert || Object.keys(cert).length === 0) {
            resolve(null);
            return;
          }

          resolve({
            subject: cert.subject,
            issuer: cert.issuer,
            valid_from: cert.valid_from,
            valid_to: cert.valid_to,
            days_remaining: Math.floor(
              (new Date(cert.valid_to).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          });
        },
      );

      socket.on("error", () => resolve(null));
      socket.on("timeout", () => {
        socket.destroy();
        resolve(null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

module.exports = {
  isValidDomain,
  fetchSSLCertificate,
};
