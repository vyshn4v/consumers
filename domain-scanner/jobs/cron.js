const cron = require("node-cron");
const retryFailedScans = require("./retry-failed");

console.log("Starting domain-scanner cron scheduler...");

// Run every 5 minutes
// Run every 3 hours
cron.schedule("0 */3 * * *", async () => {
  console.log(
    `[Cron] Executing retryFailedScans at ${new Date().toISOString()}`,
  );
  await retryFailedScans();
});

console.log("Cron scheduler is active. Waiting for the next tick.");
