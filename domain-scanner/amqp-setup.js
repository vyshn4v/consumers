const amqp = require("amqplib");
const scanner = require("./scanner");
const db = require("./db.setup");

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
        await db.query(
          `
    UPDATE scans
    SET status = $2,
        updated_at = NOW()
    WHERE id = $1
  `,
          [scanId, "running"],
        );

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
        } else {
          await db.query(
            `
    UPDATE scans
    SET status = $2,
        updated_at = NOW()
    WHERE id = $1
  `,
            [scanId, "failed"],
          );
          channel.nack(msg, false, false);
        }
      } catch (err) {
        console.error("Critical error processing message:", err);
        try {
            await db.query("ROLLBACK");
            await db.query(
            `
        UPDATE scans
        SET status = $2,
            updated_at = NOW()
        WHERE id = $1
    `,
            [scanId, "failed"],
            );
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
