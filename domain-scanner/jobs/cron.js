const cron = require("node-cron");
const retryFailedScans = require("./retry-failed");

console.log("Starting domain-scanner cron scheduler...");

// Run every 5 minutes
// The user requested to keep it 5 minutes for now and change to 3 hours later
cron.schedule("*/1 * * * *", async () => {
  console.log(
    `[Cron] Executing retryFailedScans at ${new Date().toISOString()}`,
  );
  await retryFailedScans();
});

console.log("Cron scheduler is active. Waiting for the next tick.");
