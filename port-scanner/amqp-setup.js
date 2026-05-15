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

        // Run your process here
        const response = await scanner(data);
        await db.query(
          'INSERT INTO scan_results (scan_id, "resultData", updatedAt) VALUES ($1, $2, NOW())',
          [scanId, response],
        );

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
