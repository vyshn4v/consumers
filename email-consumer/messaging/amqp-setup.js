const amqp = require("amqplib");
const { connectDb, updateContactStatus } = require("../db/db-setup");
const {
  sendContactEmail,
  sendAcknowledgementEmail,
  sendAdminCredentialsEmail,
  sendOtpEmail,
} = require("../services/mail-service");

async function startConsumer() {
  // ── 1. Connect to MongoDB ─────────────────────────────────────────────────
  await connectDb();

  // ── 2. Connect to RabbitMQ ────────────────────────────────────────────────
  const url = process.env.AMQP_URL || "amqp://localhost:5672";
  const queue = process.env.QUEUE_NAME || "contact_email_queue";

  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  // durable: true — survives broker restarts (must match the publisher setting)
  await channel.assertQueue(queue, { durable: true });
  
  const otpQueue = process.env.OTP_QUEUE_NAME || "otp_queue";
  await channel.assertQueue(otpQueue, { durable: true });

  // Process one message at a time so a slow SMTP call doesn't pile up
  channel.prefetch(1);

  console.log(`[email-consumer] Waiting for messages on "${queue}" and "${otpQueue}"...`);

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

    console.log(`[email-consumer] Processing message... (type: ${contact.type || "contact"})`);

    if (contact.type === "admin_credentials") {
      try {
        await sendAdminCredentialsEmail(contact);
        console.log("[email-consumer] ✅ Successfully sent admin credentials");
        channel.ack(msg);
      } catch (err) {
        console.error("[email-consumer] ❌ Failed to send admin credentials:", err.message);
        channel.nack(msg, false, false);
      }
      return; // Stop processing further for this message type
    }

    try {
      // ── 4. Send the notification email to the site owner ────────────────
      await sendContactEmail(contact);

      // ── 5. Send acknowledgement email back to the visitor ────────────────
      // We treat this as best-effort: if it fails we log it but still
      // ack the message since the owner notification already succeeded.
      try {
        await sendAcknowledgementEmail(contact);
        console.log(
          `[email-consumer] ✅ Acknowledgement sent to ${contact.email}`,
        );
      } catch (ackErr) {
        console.warn(
          `[email-consumer] ⚠ Acknowledgement failed for ${contact.email}:`,
          ackErr.message,
        );
      }

      // ── 6. Mark as sent in MongoDB ───────────────────────────────────────
      await updateContactStatus(contact.contactId, "sent");

      console.log(`[email-consumer] ✅ Completed contact ${contact.contactId}`);
      channel.ack(msg);
    } catch (err) {
      console.error(
        `[email-consumer] ❌ Failed for contact ${contact.contactId}:`,
        err.message,
      );

      // Mark as failed in MongoDB, then discard (no infinite retry loop)
      await updateContactStatus(contact.contactId, "failed").catch(() => {});
      channel.nack(msg, false, false);
    }
  });

  // Consume SSO OTP/Reset queue
  channel.consume(otpQueue, async (msg) => {
    if (!msg) return;

    let data;
    try {
      data = JSON.parse(msg.content.toString());
    } catch {
      console.error(`[email-consumer] Could not parse message from ${otpQueue}`);
      channel.nack(msg, false, false);
      return;
    }

    console.log(`[email-consumer] Sending SSO OTP/Reset email to: ${data.toUser}`);
    try {
      await sendOtpEmail(data);
      console.log(`[email-consumer] ✅ Successfully sent SSO email`);
      channel.ack(msg);
    } catch (err) {
      console.error(`[email-consumer] ❌ Failed to send SSO email:`, err.message);
      // Wait a bit before nacking so it doesn't spin loop aggressively? 
      // Actually standard nack will re-queue if we pass true to the 3rd param, but we'll discard for now if email failed to avoid infinite loop
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
