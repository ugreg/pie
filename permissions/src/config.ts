import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PermissionConfig } from "./types";

export class Config {

  static readonly FILE_PATH = join(homedir(), ".pi", "permissions.json");

  load(): PermissionConfig {
     let raw = "";
     try {
       raw = readFileSync(Config.FILE_PATH, "utf-8");
       if (!raw.trim()) {
         return { "error": "file is empty" };
       }
       const parsed = JSON.parse(raw);
       return parsed;
     } catch (e) {
       if (e instanceof SyntaxError) {
         return { "error": `malformed json: ${e.message}` };
       } else {
         return { "error": `error reading file: ${e}` };
       }
     }
   }

  // dup async function addCwdToConfig(
  save(config: PermissionConfig): void {
    const numSpaces = 2;
    writeFileSync(Config.FILE_PATH, JSON.stringify(config, null, numSpaces));
  }

  async addPath(
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    toolName: string
  ): Promise<void> {
    let config: PermissionConfig;
    try {
      const raw = readFileSync(Config.FILE_PATH, "utf-8");
      config = JSON.parse(raw);
    } catch (e: unknown) {
      config = { paths: [] };
    }
    
    if (!config.paths) {
      config.paths = [];
    }
    
    const cwd = process.cwd();
    if (!config.paths.includes(cwd)) {
      config.paths.push(cwd);
    }
    
    writeFileSync(Config.FILE_PATH, JSON.stringify(config, null, 2));
    
    ctx.ui.notify(`Added ${cwd} to allowed paths for ${toolName}`, "info");
  }
}
