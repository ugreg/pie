import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface Policy {
  default?: string;
  allowed?: string[];
  commands?: Record<string, Policy>;
}

interface PermissionConfig {
  restricted: string[];
  [key: string]: string[] | string | Policy | undefined;
}

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

function getPolicy(config: PermissionConfig, key: string, command?: string): "allow" | "deny" | "ask" | string {
  if (command && key === "bash") {
    const keyConfig = config[key];
    if (keyConfig && typeof keyConfig === "object" && "commands" in keyConfig) {
      const commandsConfig = keyConfig.commands;
      if (commandsConfig && typeof commandsConfig === "object") {
        for (const [pattern, policy] of Object.entries(commandsConfig)) {
          if (matchCommand(command, pattern)) {
            if (typeof policy === "object" && policy !== null && "default" in policy) {
              return (policy as Policy).default || "ask";
            }
          }
        }
      }
    }
  }
  const policyConfig = config[key];
  if (typeof policyConfig === "string") {
    return policyConfig;
  }
  if (typeof policyConfig === "object" && policyConfig !== null && "default" in policyConfig) {
    return (policyConfig as Policy).default || "ask";
  }
  return "ask";
}

function getBashAllowed(config: PermissionConfig, key: string): string[] {
  const policyConfig = config[key];
  if (typeof policyConfig === "object" && policyConfig !== null && "allowed" in policyConfig) {
    return (policyConfig as Policy).allowed || [];
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
  const regex = /["']([^"']+)["']|\b(?:\/[\w.-]+)+/g;
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
  if (!config[key] || typeof config[key] !== "object") {
    config[key] = { default: "ask", allowed: [] };
  }

  const keyConfig = config[key];
  if (keyConfig && typeof keyConfig === "object" && !(keyConfig as Policy).allowed) {
    (config[key] as Policy).allowed = [];
  }

  const cwd = process.cwd();
  const configAsPolicy = config[key] as Policy;
  if (configAsPolicy && configAsPolicy.allowed && !configAsPolicy.allowed.includes(cwd)) {
    configAsPolicy.allowed.push(cwd);
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

      policy = getPolicy(config, "bash", bashEvent.input.command) as "allow" | "deny" | "ask" | string;

      const allowed = getBashAllowed(config, "bash");
      if (Array.isArray(allowed) && isPathAllowed(cwd, allowed)) {
        return;
      }
    } else {
      toolName = event.toolName;
      resource = `${event.toolName} tool`;
      policy = getPolicy(config, toolName) as "allow" | "deny" | "ask" | string;

      const allowed = getBashAllowed(config, toolName);
      if (Array.isArray(allowed) && isPathAllowed(cwd, allowed)) {
        return;
      }
    }

    if (policy === "allow") return;
    if (policy === "deny") {
      const choice = await showPermissionDialog(
        `Permission request (${toolName})`,
        resource,
        ctx,
      );
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

    if (choice === "allow_once") {
      return;
    } else if (choice === "allow_always") {
      await addCwdToConfig(toolName, ctx, pi);
      return;
    }
    return true;
  });
}
