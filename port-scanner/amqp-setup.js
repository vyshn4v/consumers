const amqp = require("amqplib");
const scanner = require("./tools");
// const Scan = require("./db.setup");
const db = require("./db.setup");
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

      try {
        const data = JSON.parse(msg.content.toString());
        const scanId = data?.data?.scan_id;
        console.log("Received:", data);
        await db.query(
          `
    UPDATE scans
    SET status = $2,
        updated_at = NOW()
    WHERE id = $1
  `,
          [scanId, "running"],
        );
        // Run your process here
        const response = await scanner(data);
        await db.query("BEGIN");
        await db.query(
          `
  INSERT INTO scan_results (
    scan_id,
    "resultData",
    "updated_at"
  )
  VALUES ($1, $2, NOW())
  ON CONFLICT (scan_id)
  DO UPDATE SET
    "resultData" = EXCLUDED."resultData",
    "updated_at" = NOW()
  `,
          [scanId, response],
        );
        await db.query(
          `
    UPDATE scans
    SET status = $2,
        updated_at = NOW()
    WHERE id = $1
  `,
          [scanId, "completed"],
        );
        await db.query("COMMIT");
        channel.ack(msg);
      } catch (err) {
        console.error(err);

        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

consumeMessages();
