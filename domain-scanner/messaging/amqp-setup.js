const amqp = require("amqplib");
const scanner = require("../tools/scanner");
const db = require("../db/db.setup");

const MAX_RETRIES = 3;

async function consumeMessages() {
  try {
    const connection = await amqp.connect(
      process.env.AMQP_URL || "amqp://localhost:5672",
    );

    const channel = await connection.createChannel();

    const queue = "domain_scan_queue";

    await channel.assertQueue(queue, {
      durable: true,
    });

    channel.prefetch(1);

    console.log("Waiting for domain scan messages...");

    channel.consume(queue, async (msg) => {
      if (!msg) return;

      const data = JSON.parse(msg.content.toString());
      const scanId = data?.data?.scanId || data?.scanId || data?.data?.scan_id || data?.scan_id;
      console.log("Received:", data);

      let attempt = 0;
      let success = false;
      let response = null;

      try {
        await db.updateScanStatus(scanId, "running");

        while (attempt < MAX_RETRIES && !success) {
          attempt++;
          console.log(`Scanning attempt ${attempt} for scan_id: ${scanId}`);
          try {
            response = await scanner(data);
            if (response.success) {
              success = true;
            } else {
              console.error(`Attempt ${attempt} failed:`, response.error);
              if (attempt < MAX_RETRIES) {
                await new Promise((res) => setTimeout(res, 2000 * attempt)); // exponential backoff
              }
            }
          } catch (err) {
            console.error(`Attempt ${attempt} threw an error:`, err);
            if (attempt < MAX_RETRIES) {
              await new Promise((res) => setTimeout(res, 2000 * attempt)); // exponential backoff
            }
          }
        }

        if (success && response) {
          await db.query("BEGIN");
          await db.saveScanResult(scanId, response);
          await db.updateScanStatus(scanId, "completed");
          await db.query("COMMIT");
          channel.ack(msg);
        } else {
          await db.updateScanStatus(scanId, "failed");
          channel.nack(msg, false, false);
        }
      } catch (err) {
        console.error("Critical error processing message:", err);
        try {
            await db.query("ROLLBACK");
            await db.updateScanStatus(scanId, "failed");
        } catch(dbErr) {
            console.error("DB rollback failed:", dbErr);
        }
        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

consumeMessages();
