import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PermissionConfig } from "./types";

export class Config {

  static readonly FILE_PATH = join(homedir(), ".pi", "permissions.json");

  // dup async function addCwdToConfig(
  save(config: PermissionConfig): void {
    const numSpaces = 2;
    writeFileSync(Config.FILE_PATH, JSON.stringify(config, null, numSpaces));
  }

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

  async verify(ctx: ExtensionContext, policies: PermissionConfig): void {
    if (!policies) {
      ctx.ui.notify(`Config not loaded`, "error");
      ctx.abort();
      return;
    }
    if (policies.error) {
      ctx.ui.notify(`Aborting: (${policies.error})`, "error");
      ctx.abort();
      return;
    } else if (policies.paths && policies.paths.length > 0) {
      if (!manager.isPathAllowed(cwd, policies.paths)) {
        ctx.ui.notify(`Aborting: Current directory (${cwd}) not in allowed paths`, "error");
        ctx.abort();
        return;
      }
    } else {
      ctx.ui.notify(`Aborting: allowed paths empty or not proper format`, "error");
      ctx.abort();
      return;
    }
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
