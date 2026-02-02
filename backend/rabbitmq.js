// backend/rabbitmq.js

const amqp = require("amqplib");

const RABBIT_URL = process.env.RABBIT_URL || "amqp://localhost";
const EXCHANGE_NAME = "medass_events";

let connection = null;
let channel = null;

/**
 * Connect to RabbitMQ and create a channel + exchange.
 * Call this ONCE on server startup.
 */
async function connectRabbit(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      if (connection && channel) {
        return; // already connected
      }

      console.log(`[RabbitMQ] Connecting... (Attempt ${i + 1}/${retries})`);
      connection = await amqp.connect(RABBIT_URL);
      channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGE_NAME, "topic", {
        durable: true
      });

      console.log("[RabbitMQ] Connected and exchange ready:", EXCHANGE_NAME);

      // Handle connection close
      connection.on("close", () => {
        console.error("[RabbitMQ] Connection closed. Resetting connection variable.");
        connection = null;
        channel = null;
      });

      connection.on("error", (err) => {
        console.error("[RabbitMQ] Connection error:", err);
      });

      return; // Success!
    } catch (err) {
      console.error(`[RabbitMQ] Failed to connect (Attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error("[RabbitMQ] Giving up on connection. App will run without MQ.");
        connection = null;
        channel = null;
      }
    }
  }
}

/**
 * Publish an event to the exchange.
 * routingKey examples:
 *  - "order.created"
 *  - "order.status.updated"
 */
async function publishEvent(routingKey, payload) {
  try {
    if (!channel) {
      console.warn("[RabbitMQ] Channel not ready, event skipped:", routingKey);
      return;
    }

    const buffer = Buffer.from(JSON.stringify(payload));

    channel.publish(EXCHANGE_NAME, routingKey, buffer, {
      persistent: true,
      contentType: "application/json"
    });

    // no await needed – publish is sync on channel
    // console.log("[RabbitMQ] Published:", routingKey, payload);
  } catch (err) {
    console.error("[RabbitMQ] publishEvent error:", err);
  }
}

/**
 * Helper to create a queue that listens to some routing keys
 * and passes the messages to your handler.
 *
 * Example usage (in a worker process):
 *   consumeEvents("order_worker_queue", ["order.*"], async (msg) => {...})
 */
async function consumeEvents(queueName, bindingKeys, handler) {
  await connectRabbit(); // ensure connection

  if (!channel) {
    console.error("[RabbitMQ] Cannot consume, channel not ready");
    return;
  }

  await channel.assertQueue(queueName, { durable: true });

  for (const key of bindingKeys) {
    await channel.bindQueue(queueName, EXCHANGE_NAME, key);
  }

  console.log(
    `[RabbitMQ] Waiting for messages in queue "${queueName}" for keys: ${bindingKeys.join(
      ", "
    )}`
  );

  channel.consume(
    queueName,
    async (msg) => {
      if (!msg) return;

      try {
        const content = msg.content.toString();
        const data = JSON.parse(content);

        await handler(msg.fields.routingKey, data);

        channel.ack(msg);
      } catch (err) {
        console.error("[RabbitMQ] Handler error, message NOT acked:", err);
        // You can choose to nack and requeue or send to DLQ in future.
        channel.nack(msg, false, false); // drop for now
      }
    },
    { noAck: false }
  );
}

module.exports = {
  connectRabbit,
  publishEvent,
  consumeEvents
};
