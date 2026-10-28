import crypto from "crypto";
import fs from "fs";

export function computeSha256(data: string | Buffer): string {
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

export function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve("0x" + hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}
