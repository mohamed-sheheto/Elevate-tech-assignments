import { claim, complete } from "./dedupRedis.js";
import { job } from "./server.js";
import amqb from "amqplib";

const QUEUE = "image-processing-queue";

function cropImage(job: job) {
  const processingMs = 500 + Math.floor(Math.random() * 1500);
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve(`${job.image} cropped to ${job.cropWidth}x${job.cropHeight}`),
      processingMs,
    );
  });
}

async function main() {
  const connection = await amqb.connect("amqp://localhost");
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE, { durable: true });
  await channel.prefetch(1);

  console.log(`worker waiting for jobs on "${QUEUE}"`);

  channel.consume(QUEUE, async (msg) => {
    if (msg === null) return;

    const job = JSON.parse(msg.content.toString());

    let status;
    try {
      status = await claim(job.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      console.error(`redis unavailable, requeueing: ${job.id}`, message);
      channel.nack(msg, false, true);
      return;
    }

    if (status === "duplicate") {
      console.log(`duplicate, skipping: ${job.id} ${job.image}`);

      channel.ack(msg);
      return;
    }

    if (status === "retry") {
      console.log(`retrying interrupted job: ${job.id} ${job.image}`);
    }

    try {
      const result = await cropImage(job);
      console.log(`[worker finished: ${result}`);

      await complete(job.id);
      channel.ack(msg);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      console.error(`worker failed: ${job.id}`, message);
      channel.nack(msg, false, true);
    }
  });
}

main().catch((err) => {
  console.error(`worker error:`, err.message);
  process.exit(1);
});
