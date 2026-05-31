const db = require("../db/db.setup");
const amqp = require("amqplib");

async function retryFailedScans() {
  let connection = null;
  let channel = null;

  try {
    console.log("[Retry Job] Fetching failed scans...");

    const retryLimit = parseInt(process.env.RETRY_LIMIT) || 50;

    // Atomic update with limit: finds 'failed' scans up to retryLimit, locks them, changes to 'schedule', and returns them.
    const result = await db.query(
      `UPDATE scans 
       SET status = 'schedule', updated_at = NOW() 
       WHERE id IN (
         SELECT id FROM scans 
         WHERE status = 'failed' 
         LIMIT $1 
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, domain, sso_user_id`,
      [retryLimit],
    );

    const failedScans = result.rows;

    if (failedScans.length === 0) {
      console.log("[Retry Job] No failed scans found to retry.");
      return;
    }

    console.log(
      `[Retry Job] Found ${failedScans.length} failed scan(s). Preparing to enqueue...`,
    );

    connection = await amqp.connect(
      process.env.AMQP_URL || "amqp://localhost:5672",
    );
    channel = await connection.createChannel();

    const queue = process.env.QUEUE_NAME || "domain_scan_queue";
    await channel.assertQueue(queue, { durable: true });

    let requeuedCount = 0;

    for (const scan of failedScans) {
      const payload = {
        scanId: scan.id,
        domain: scan.domain,
        userId: scan.sso_user_id,
        retry: true,
      };

      const enqueued = channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
      );

      if (enqueued) {
        requeuedCount++;
      } else {
        console.error(
          `[Retry Job] Failed to push scanId ${scan.id} to the queue!`,
        );
      }
    }

    console.log(
      `[Retry Job] Successfully requeued ${requeuedCount}/${failedScans.length} scan(s).`,
    );
  } catch (error) {
    console.error(
      "[Retry Job] Error occurred while retrying failed scans:",
      error,
    );
  } finally {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = retryFailedScans;
