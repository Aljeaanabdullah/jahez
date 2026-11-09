import { rmSync } from "node:fs";
import path from "node:path";
import { cleanUp } from "./accounts";

export default async function globalTeardown() {
  await cleanUp();
  rmSync(path.resolve(__dirname, ".auth"), { recursive: true, force: true });
}
