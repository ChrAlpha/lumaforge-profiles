import path from "node:path";

import { config } from "dotenv";

export interface LoadDotenvFilesOptions {
  cwd?: string;
}

export function loadDotenvFiles(options: LoadDotenvFilesOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  config({
    path: path.join(cwd, ".env"),
    override: false,
    quiet: true,
  });
}
