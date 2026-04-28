import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

export function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
