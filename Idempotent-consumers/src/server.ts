import express, { Request, Response } from "express";
import { randomUUID, UUID } from "crypto";
import amqb from "amqplib";

const QUEUE = "image-processing-queue";
export type job = {
  id: UUID;
  image: string;
  cropWidth: string;
  cropHeight: string;
};

const app = express();
app.use(express.json());

let channel: amqb.Channel;

async function initRabbit(): Promise<void> {
  const connection = await amqb.connect("amqp://localhost");
  channel = await connection.createChannel();

  await channel.assertQueue(QUEUE, { durable: true });

  connection.on("close", () => {
    console.error("rabbitmq connection closed, exiting");
    process.exit(1);
  });
}

app.post("/crop", async (req: Request, res: Response) => {
  const { image, cropWidth, cropHeight } = req.body;

  if (!image || !cropWidth || !cropHeight) {
    return res
      .status(400)
      .json({ error: "image, cropWidth, cropHeight are required" });
  }

  const job: job = { id: randomUUID(), image, cropWidth, cropHeight };

  channel.publish("", QUEUE, Buffer.from(JSON.stringify(job)), {
    persistent: true,
  });

  res.status(202).json({ jobId: job.id, status: "queued" });
});

async function main(): Promise<void> {
  await initRabbit();
  app.listen(3000, () => console.log("[api] listening on :3000"));
}

main().catch((err) => {
  console.error("[api] failed to start:", err.message);
  process.exit(1);
});
