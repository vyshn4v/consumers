const amqp = require("amqplib");
const scanner = require("../tools/tools");
const db = require("../db/db.setup");
async function consumeMessages() {
  try {
    const connection = await amqp.connect(
      process.env.AMQP_URL || "amqp://localhost:5672",
    );

    const channel = await connection.createChannel();

    const queue = "scan_queue";

    await channel.assertQueue(queue, {
      durable: true,
    });

    channel.prefetch(1);

    console.log("Waiting for messages...");

    channel.consume(queue, async (msg) => {
      if (!msg) return;

      const data = JSON.parse(msg.content.toString());
      const scanId = data?.data?.scanId || data?.scanId || data?.data?.scan_id || data?.scan_id;
      console.log("Received:", data);
      try {
        await db.updateScanStatus(scanId, "running");
        // Run your process here
        const response = await scanner(data);
        if (response.success) {
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
        console.error(err);
        await db.query("ROLLBACK");
        await db.updateScanStatus(scanId, "failed");
        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

consumeMessages();
