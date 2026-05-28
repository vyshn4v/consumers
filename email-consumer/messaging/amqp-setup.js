const amqp = require("amqplib");
const { connectDb, updateContactStatus } = require("../db/db-setup");
const { sendContactEmail } = require("../services/mail-service");

async function startConsumer() {
  // ── 1. Connect to MongoDB ─────────────────────────────────────────────────
  await connectDb();

  // ── 2. Connect to RabbitMQ ────────────────────────────────────────────────
  const url   = process.env.AMQP_URL   || "amqp://localhost:5672";
  const queue = process.env.QUEUE_NAME || "contact_email_queue";

  const connection = await amqp.connect(url);
  const channel    = await connection.createChannel();

  // durable: true — survives broker restarts (must match the publisher setting)
  await channel.assertQueue(queue, { durable: true });

  // Process one message at a time so a slow SMTP call doesn't pile up
  channel.prefetch(1);

  console.log(`[email-consumer] Waiting for messages on "${queue}"...`);

  // ── 3. Consume messages ───────────────────────────────────────────────────
  channel.consume(queue, async (msg) => {
    if (!msg) return;

    let contact;
    try {
      contact = JSON.parse(msg.content.toString());
    } catch {
      // Malformed message — reject without requeue
      console.error("[email-consumer] Could not parse message — discarding");
      channel.nack(msg, false, false);
      return;
    }

    console.log(`[email-consumer] Processing contact ${contact.contactId}`);

    try {
      // ── 4. Send the email ───────────────────────────────────────────────
      await sendContactEmail(contact);

      // ── 5. Mark as sent in MongoDB ──────────────────────────────────────
      await updateContactStatus(contact.contactId, "sent");

      console.log(`[email-consumer] ✅ Sent email for contact ${contact.contactId}`);
      channel.ack(msg);

    } catch (err) {
      console.error(`[email-consumer] ❌ Failed for contact ${contact.contactId}:`, err.message);

      // Mark as failed in MongoDB, then discard (no infinite retry loop)
      await updateContactStatus(contact.contactId, "failed").catch(() => {});
      channel.nack(msg, false, false);
    }
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  process.on("SIGINT", async () => {
    console.log("\n[email-consumer] Shutting down...");
    await channel.close();
    await connection.close();
    process.exit(0);
  });
}

startConsumer().catch((err) => {
  console.error("[email-consumer] Fatal startup error:", err.message);
  process.exit(1);
});
