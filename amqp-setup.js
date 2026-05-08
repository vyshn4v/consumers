const amqp = require('amqplib');
const scanner = require('./tools');
const Scan = require('./db.setup');
async function consumeMessages() {
  try {
    const connection = await amqp.connect(
      process.env.AMQP_URL || 'amqp://localhost:5672',
    );

    const channel = await connection.createChannel();

    const queue = 'scan_queue';

    await channel.assertQueue(queue, {
      durable: true,
    });

    channel.prefetch(1);

    console.log('Waiting for messages...');

    channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const data = JSON.parse(msg.content.toString());

        console.log('Received:', data);

        // Run your process here
        const response = await scanner(data);
        await Scan.create({
          ...response,
        });

        console.log('Processed:', response);

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
