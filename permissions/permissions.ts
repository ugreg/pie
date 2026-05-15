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

function matchCommand(cmd: string, pattern: string): boolean {
  if (cmd === pattern) {
    return true;
  }
  
  if (pattern.endsWith(" *")) {
    const prefix = pattern.slice(0, -2);
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

function getToolPolicy(config: PermissionConfig, toolName: string): "allow" | "deny" | "ask" {
  if (config.allow?.includes(toolName)) {
    return "allow";
  }
  
  if (config.deny?.includes(toolName)) {
    return "deny";
  }
  
  if (config.ask?.includes(toolName)) {
    return "ask";
  }
  
  return "ask";
}

function getBashPolicy(config: PermissionConfig, command: string): "allow" | "deny" | "ask" {
  if (config.deny) {
    for (const pattern of config.deny) {
      if (matchCommand(command, pattern)) {
        return "deny";
      }
    }
  }
  
  if (config.allow) {
    for (const tool of config.allow) {
      if (tool === command || (tool.endsWith(" *") && command.startsWith(tool.slice(0, -2) + " "))) {
        return "allow";
      }
    }
  }
  
  if (config.ask) {
    for (const tool of config.ask) {
      if (tool === command || (tool.endsWith(" *") && command.startsWith(tool.slice(0, -2) + " "))) {
        return "ask";
      }
    }
  }
  
  return "ask";
}

async function showPermissionDialog(
  action: string,
  resource: string,
  ctx: ExtensionContext,
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
  toolName: string,
  resource: string,
  decision: "allow_once" | "allow_always" | "reject",
  ctx: ExtensionContext,
): void {

  const statusMessage = decision === "reject"
    ? "Rejected"
    : decision === "allow_once"
      ? "Approved (once)"
      : "Approved (always)";

  let toolNotice = "";
  
  if (toolName === "bash") {
    toolNotice = `${statusMessage} Permission request (${toolName}) tool command: ${resource}`;
  } else {
    toolNotice = `${statusMessage} Permission request (${toolName}) tool`;
  }

  ctx.ui.notify(toolNotice, decision === "reject" ? "error" : "info");
}

async function addCwdToConfig(
  toolName: string,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
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

async function checkPermission(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  event: ToolCallEvent,
): Promise<{ block: boolean; reason?: string }> {
  const config = loadConfig();
  const cwd = process.cwd();
  
  if (config.paths && config.paths.length > 0) {
    if (!isPathAllowed(cwd, config.paths)) {
      return { block: true, reason: "Current directory not in allowed paths" };
    }
  }
  
  let toolName = event.toolName;
  let policy: "allow" | "deny" | "ask";
  let resource = `${toolName} tool`;
  
  if (event.toolName === "bash" && event.input.command) {
    toolName = "bash";
    resource = event.input.command;
    policy = getBashPolicy(config, event.input.command);
  } else {
    policy = getToolPolicy(config, toolName);
  }
  
  if (policy === "allow") {
    return { block: false };
  }
  
  if (policy === "deny") {
    const choice = await showPermissionDialog(
      `Permission request (${toolName})`,
      resource,
      ctx,
    );

    sendPermissionNotification(toolName, resource, choice, ctx);
    
    if (choice === "allow_once") {
      return { block: false };
    }
    
    if (choice === "allow_always") {
      return { block: false };
    }
    
    return { block: true, reason: "Permission denied by user" };
  }
  
  const choice = await showPermissionDialog(
    `Permission request (${toolName})`,
    resource,
    ctx,
  );
  
  sendPermissionNotification(toolName, resource, choice, ctx);
  
  if (choice === "allow_once") {
    return { block: false };
  }
  
  if (choice === "allow_always") {
    return { block: false };
  }
  
  return { block: true, reason: "Permission denied by user" };
}

function getPolicy(config: PermissionConfig, key: string, command?: string): "allow" | "deny" | "ask" {
  if (command && key === "bash") {
    return getBashPolicy(config, command);
  }
  return getToolPolicy(config, key);
}

function getBashAllowed(config: PermissionConfig, key: string): string[] {
  const policy = getBashPolicy(config, key);
  return policy === "allow" ? [] : [];
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
    }
    else if (config.paths && config.paths.length > 0) {
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

    let toolName: string;
    let resource: string;
    let policy: "allow" | "deny" | "ask" | string;

    ctx.ui.notify(`Tool: ${event.toolName}`, "info");
    if (event.toolName === "bash") {
      const bashEvent = event as ToolCallEvent;
      toolName = "bash";
      resource = bashEvent.input.command;
      ctx.ui.notify(`Bash: ${resource}`, "info");

      const commandPaths = extractPathsFromCommand(bashEvent.input.command);
      if (config.paths && config.paths.length > 0) {
        if (commandPaths.some(p => !isPathAllowed(p, config.paths))) {
          ctx.ui.notify(`Aborting: Command accesses restricted path`, "error");
          ctx.abort();
          return;
        }
      }

      policy = getPolicy(config, "bash", bashEvent.input.command);

      if (policy === "ask") {
        const allowed = getBashAllowed(config, "bash");
        if (Array.isArray(allowed) && isPathAllowed(cwd, allowed)) {
          return;
        }
      }
    } else {
      toolName = event.toolName;
      resource = `${event.toolName} tool`;
      policy = getPolicy(config, toolName);

      if (config.paths && config.paths.length > 0) {
        if (!isPathAllowed(cwd, config.paths)) {
          ctx.ui.notify(`Aborting: Current directory (${cwd}) not in allowed paths`, "error");
          ctx.abort();
          return true;
        }
      }

      if (policy === "ask") {
        const allowed = getBashAllowed(config, toolName);
        if (Array.isArray(allowed) && isPathAllowed(cwd, allowed)) {
          return;
        }
      }
    }

    if (policy === "allow") return;

    const choice = await showPermissionDialog(
      `Permission request (${toolName})`,
      resource,
      ctx,
    );
    if (policy === "deny") {
      sendPermissionNotification(toolName, resource, choice, ctx);
      if (choice === "allow_once") return;
      if (choice === "allow_always") {
        await addCwdToConfig(toolName, ctx, pi);  
        return;
      }
      ctx.abort();
    }
    if (choice === "allow_once") {
      sendPermissionNotification(toolName, resource, choice, ctx);
      return;
    } else if (choice === "allow_always") {
      sendPermissionNotification(toolName, resource, choice, ctx);
      await addCwdToConfig(toolName, ctx, pi);
      return;
    } else {
      ctx.abort();
    }
  });
}

export {
  getPolicy,
  loadConfig,
  isPathAllowed,
  isPathRestricted,
  extractPathsFromCommand,
  getBashAllowed,
  checkPermission
};
