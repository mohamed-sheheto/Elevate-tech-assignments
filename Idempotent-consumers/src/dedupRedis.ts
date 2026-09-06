import { UUID } from "crypto";
import { Redis } from "ioredis";

const redis = new Redis(6379);

export async function claim(
  jobId: UUID,
): Promise<"claimed" | "duplicate" | "retry"> {
  const result = await redis.set(jobId, "processing", "EX", 24 * 60 * 60, "NX");

  if (result === "OK") return "claimed";

  const status = await redis.get(jobId);
  return status === "completed" ? "duplicate" : "retry";
}

export async function complete(jobId: UUID) {
  await redis.set(jobId, "completed", "EX", 24 * 60 * 60);
}
