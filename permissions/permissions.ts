import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PermissionConfig, ToolCallEvent, SendOptions } from "./permissions.types";

const CONFIG_PATH = join(homedir(), ".pi", "permissions.json");

function loadConfig(): PermissionConfig {
   let raw = "";
   try {
     raw = readFileSync(CONFIG_PATH, "utf-8");
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

function saveConfig(config: PermissionConfig): void {
  const numSpaces = 2;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, numSpaces));
}

function isBashCommand(cmd: string): boolean {
  if (cmd.endsWith(" *")) {
    const prefix = cmd.slice(0, -2);
    return cmd.startsWith(prefix + " ");
  }

  return false;
}

function isPathAllowed(path: string, allowed: string[] | undefined): boolean {
  const normalized = path.replace(/\\/g, "/");
  const home = homedir();
  return (allowed ?? []).some((allowedPath) => {
    const resolved = allowedPath.replace("~", home);
    return normalized === resolved || normalized.startsWith(resolved + "/");
  });
}

function isPathRestricted(path: string, restricted: string[]): boolean {
  const normalized = path.replace(/\\/g, "/");
  const home = homedir();
  return restricted.some((restrictedPath) => {
    const resolved = restrictedPath.replace("~", home);
    return normalized === resolved || normalized.startsWith(resolved + "/");
  });
}

function extractPathsFromCommand(cmd: string): string[] {
  const paths: string[] = [];
  const regex = /["']([^"']+)["']|(?:\/[^\s]+)+/g;
  let match;
  while ((match = regex.exec(cmd)) !== null) {
    paths.push(match[1] || match[0]);
  }
  return paths;
}

function getPolicy(config: PermissionConfig, toolName: string): "allow" | "deny" | "ask" {
  if (config.allow?.includes(toolName)) {
    return "allow";
  }
  
  if (config.deny?.includes(toolName)) {
    return "deny";
  }
  
  if (config.ask?.includes(toolName)) {
    return "ask";
  }
  
  return "deny";
}

async function showPermissionDialog(
  ctx: ExtensionContext,
  action: string,
  resource: string
): Promise<"allow_once" | "allow_always" | "reject"> {
  if (ctx.hasUI) {
    const options = ["Allow once", "Allow always", "Reject"];
    const choice = await ctx.ui.select(`! ${action}: ${resource}`, options);
    if (choice === options[0]) return "allow_once";
    if (choice === options[1]) return "allow_always";
    return "reject";
  }
  return "allow_once";
}

function sendPermissionNotification(
  ctx: ExtensionContext,
  toolName: string,
  cmd: string,
  decision: "allow_once" | "allow_always" | "reject"
): void {

  const statusMessage = decision === "reject"
    ? "Rejected"
    : decision === "allow_once"
      ? "Approved (once)"
      : "Approved (always)";

  let toolNotice = "";
  
  if (toolName === "bash") {
    toolNotice = `${statusMessage} Permission request (${toolName}) tool command: ${cmd}`;
  } else {
    toolNotice = `${statusMessage} Permission request (${toolName}) tool`;
  }

  ctx.ui.notify(toolNotice, decision === "reject" ? "error" : "info");
}

async function addCwdToConfig(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  toolName: string
): Promise<void> {
  let config: PermissionConfig;
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
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
  
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  
  ctx.ui.notify(`Added ${cwd} to allowed paths for ${toolName}`, "info");
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!existsSync(CONFIG_PATH)) {
      ctx.ui.notify(`Unable to find ${CONFIG_PATH}. Please create ${CONFIG_PATH}`, "warning");
    } else {
      ctx.ui.notify("Permissions extension loaded!\n", "info");
    }
  });

  pi.on("tool_call" as any, async (event: any, ctx: ExtensionContext) => {
    const cwd = process.cwd();
    ctx.ui.notify(`Current path: (${cwd})`, "info");

    const config = loadConfig();
    if (!config) {
      ctx.ui.notify(`Config not loaded`, "error");
      ctx.abort();
      return;
    }

    if (config.error) {
      ctx.ui.notify(`Aborting: (${config.error})`, "error");
      ctx.abort();
      return;
    } else if (config.paths && config.paths.length > 0) {
      if (!isPathAllowed(cwd, config.paths)) {
        ctx.ui.notify(`Aborting: Current directory (${cwd}) not in allowed paths`, "error");
        ctx.abort();
        return;
      }
    } else {
      ctx.ui.notify(`Aborting: allowed paths empty or not proper format`, "error");
      ctx.abort();
      return;
    }

    if (config.paths && config.paths.length > 0) {
      if (!isPathAllowed(cwd, config.paths)) {
        ctx.ui.notify(`Aborting: Current directory (${cwd}) not in allowed paths`, "error");
        ctx.abort();
        return true;
      }
    }

    let toolName: string;
    let fullCommand: string;
    let policy: "allow" | "deny" | "ask" | string;

    ctx.ui.notify(`Tool: ${event.toolName}`, "info");
    
    toolName = event.toolName;
    fullCommand = "";
    if (event.toolName === "bash" && event.input.command && isBashCommand(event.input.command)) {
      fullCommand = event.input.command;
      const bashCommand = event.input.command.split(" ")[0];
      toolName = bashCommand;
    }
    policy = getPolicy(config, toolName);

    if (policy === "allow") return;

    if (policy === "ask") {
      const choice = await showPermissionDialog(ctx, `Permission request (${toolName})`, fullCommand);
      if (choice === "allow_once") {
        sendPermissionNotification(ctx, toolName, fullCommand, choice);
        return;
      } else if (choice === "allow_always") {
        sendPermissionNotification(ctx, toolName, fullCommand, choice);
        await addCwdToConfig(ctx, pi, toolName);
        return;
      } else {
        ctx.abort();
      }
    }

    if (policy === "deny") {
      sendPermissionNotification(ctx, toolName, fullCommand, "reject");
      ctx.abort();
    }
  });
}

export {
  getPolicy,
  loadConfig,
  isPathAllowed,
  isPathRestricted,
  extractPathsFromCommand
};
