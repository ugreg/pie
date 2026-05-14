import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { CommandPolicy, BashPolicy, ToolPolicy, ExtensionToolsPolicy, PermissionConfig } from "./permissions.types";

interface ToolCallEvent {
  toolName: string;
  input: { command: string };
}

interface SendOptions {
  triggerTurn: boolean;
  deliverAs: string;
}

const CONFIG_PATH = join(homedir(), ".pi", "permissions.json");

function loadConfig(): PermissionConfig {
  const configPath = CONFIG_PATH;
  if (!existsSync(configPath)) {
    return {
      restricted: [],
    };
  }
  
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      restricted: [],
    };
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

function getBashCommands(bashPolicy: BashPolicy | undefined): Record<string, CommandPolicy> | undefined {
  return bashPolicy as Record<string, CommandPolicy>;
}

function findMatchingCommandPolicy(
  commands: Record<string, CommandPolicy> | undefined,
  command: string
): string {
  if (!commands) return "ask";
  
  for (const [pattern, policy] of Object.entries(commands)) {
    if (matchCommand(command, pattern)) {
      return policy.default || "ask";
    }
  }
  return "ask";
}

function getToolPolicy(config: PermissionConfig, key: string): ToolPolicy | undefined {
  if (config.tools && config.tools[key]) {
    return config.tools[key];
  }
  
  if (config.extensionTools && config.extensionTools[key]) {
    return config.extensionTools[key];
  }
  
  const rootPolicy = config[key as keyof PermissionConfig];
  if (rootPolicy && typeof rootPolicy === "object") {
    return rootPolicy as ToolPolicy;
  }
  
  return undefined;
}

function getPolicy(config: PermissionConfig, key: string, command?: string): "allow" | "deny" | "ask" {
  if (command && key === "bash") {
    const bashPolicy = config.bash;
    const commands = getBashCommands(bashPolicy);
    if (commands) {
      const matchedPolicy = findMatchingCommandPolicy(commands, command);
      if (matchedPolicy !== "ask") {
        return matchedPolicy as "allow" | "deny" | "ask";
      }
    }
  }

  const toolPolicy = getToolPolicy(config, key);
  if (toolPolicy) {
    return toolPolicy.default || "ask";
  }

  return "ask";
}

function getPolicyAllowed(policy: ToolPolicy | BashPolicy | undefined): string[] {
  if (policy && typeof policy === "object") {
    return (policy as ToolPolicy).allowed || [];
  }
  return [];
}

function getBashAllowed(config: PermissionConfig, key: string): string[] {
  const toolPolicy = getToolPolicy(config, key);
  if (toolPolicy) {
    return getPolicyAllowed(toolPolicy);
  }
  
  return [];
}

function isPathAllowed(path: string, allowed: string[]): boolean {
  const normalized = path.replace(/\\/g, "/");
  return allowed.some((allowedPath) => normalized.startsWith(allowedPath));
}

function isPathRestricted(path: string, restricted: string[]): boolean {
  const normalized = path.replace(/\\/g, "/");
  const home = homedir();
  return restricted.some((restrictedPath) => {
    const resolved = restrictedPath.replace("~", home);
    return normalized.startsWith(resolved);
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

async function showPermissionDialog(
  action: string,
  resource: string,
  ctx: ExtensionContext,
): Promise<"allow_once" | "allow_always" | "reject"> {
  if (ctx.hasUI) {
    const options = ["Allow once", `Allow always (add cwd to ${CONFIG_PATH})`, "Reject"];
    const choice = await ctx.ui.select(`● ${action}: ${resource}`, options);
    if (choice === options[0]) return "allow_once";
    if (choice === options[1]) return "allow_always";
    return "reject";
  }
  return "allow_once";
}

function sendPermissionNotification(
  toolName: string,
  decision: "allow_once" | "allow_always" | "reject",
  ctx: ExtensionContext,
): void {
  const statusMessage = decision === "reject"
    ? "Rejected"
    : decision === "allow_once"
      ? "Approved (once)"
      : "Approved (always)";
  
  ctx.ui.notify(
    `${statusMessage} Permission request (${toolName}): ${toolName} tool`,
    decision === "reject" ? "error" : "success",
  );
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
    await pi.sendMessage({
      customType: "permissions-extension",
      content: `Failed to parse ${CONFIG_PATH}: ${(e as Error).message}`,
      display: true,
    }, {
      triggerTurn: true,
      deliverAs: "steer",
    });
    return;
  }

  const key = toolName === "bash" ? "bash" : toolName;
  
  if (key === "bash") {
    if (!config[key] || typeof config[key] !== "object") {
      config[key] = {} as BashPolicy;
    }
    
  } else {
    let policyObj = config[key as keyof PermissionConfig];
    let isToolsObject = false;
    
    if (config.tools && config.tools[key]) {
      policyObj = config.tools[key];
      isToolsObject = true;
    }
    else if (config.extensionTools && config.extensionTools[key]) {
      policyObj = config.extensionTools[key];
      isToolsObject = true;
    }
    
    if (!policyObj || typeof policyObj !== "object") {
      if (isToolsObject) {
        if (!config.tools) config.tools = {};
        if (!config.extensionTools) config.extensionTools = {};
        (config.tools as ExtensionToolsPolicy)[key] = { default: "ask", allowed: [] };
        (config.extensionTools as ExtensionToolsPolicy)[key] = { default: "ask", allowed: [] };
      } else {
        config[key] = { default: "ask", allowed: [] } as ToolPolicy;
      }
    }

    const keyConfig = isToolsObject ? (config.tools as ExtensionToolsPolicy)[key] : config[key];
    if (keyConfig && typeof keyConfig === "object" && !(keyConfig as ToolPolicy).allowed) {
      if (isToolsObject) {
        (config.tools as ExtensionToolsPolicy)[key].allowed = [];
      } else {
        (config[key] as ToolPolicy).allowed = [];
      }
    }

    const cwd = process.cwd();
    const configAsPolicy = isToolsObject ? (config.tools as ExtensionToolsPolicy)[key] : (config[key] as ToolPolicy);
    if (configAsPolicy && configAsPolicy.allowed && !configAsPolicy.allowed.includes(cwd)) {
      if (isToolsObject) {
        (config.tools as ExtensionToolsPolicy)[key].allowed.push(cwd);
      } else {
        (config[key] as ToolPolicy).allowed.push(cwd);
      }
    }
  }

  saveConfig(config);
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
    const config = loadConfig();
    const cwd = process.cwd();

    let toolName: string;
    let resource: string;
    let policy: "allow" | "deny" | "ask" | string;

    if (event.toolName === "bash") {
      const bashEvent = event as ToolCallEvent;
      toolName = "bash";
      resource = bashEvent.input.command;

      const paths = extractPathsFromCommand(bashEvent.input.command);
      if (paths.some(p => isPathRestricted(p, config.restricted))) {
        return true;
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

      if (policy === "ask") {
        const allowed = getBashAllowed(config, toolName);
        if (Array.isArray(allowed) && isPathAllowed(cwd, allowed)) {
          return;
        }
      }
    }

    if (policy === "allow") return;
    if (policy === "deny") {
      const choice = await showPermissionDialog(
        `Permission request (${toolName})`,
        resource,
        ctx,
      );
      sendPermissionNotification(toolName, choice, ctx);
      if (choice === "allow_once") return;
      if (choice === "allow_always") {
        await addCwdToConfig(toolName, ctx, pi);
        return;
      }
      return true;
    }
    const choice = await showPermissionDialog(
      `Permission request (${toolName})`,
      resource,
      ctx,
    );

    sendPermissionNotification(toolName, choice, ctx);

    if (choice === "allow_once") {
      return;
    } else if (choice === "allow_always") {
      await addCwdToConfig(toolName, ctx, pi);
      return;
    }
    return true;
  });
}

export {
  getPolicy,
  loadConfig,
  isPathRestricted,
  extractPathsFromCommand,
  getBashAllowed,
  isPathAllowed
};
