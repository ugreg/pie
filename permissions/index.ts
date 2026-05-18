import { homedir } from "os";
import { existsSync } from "fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { Config } from "./src/config";
import { BashCommand, PermissionConfig, ToolCallEvent, SendOptions } from "./src/types";

function isBashCommand(cmd: string): boolean {
  if (cmd.endsWith(" *")) {
    const prefix = cmd.slice(0, -2);
    return cmd.startsWith(prefix + " ");
  }

  return false;
}

function extractBashCommand(event: any): BashCommand {
  let bc: BashCommand = { command: "", args: "" };
  bc.command = event.input.command;
  bc.args = event.input.command.split(" ")[0];

  return bc;
}

function isPathAllowed(path: string, allowed: string[] | undefined): boolean {
  const normalized = path.replace(/\\/g, "/");
  const home = homedir();
  return (allowed ?? []).some((allowedPath) => {
    const resolved = allowedPath.replace("~", home);
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

export default function (pi: ExtensionAPI) {
  const config = new Config();
  
  pi.on("session_start", async (_event, ctx) => {
    if (!existsSync(Config.FILE_PATH)) {
      ctx.ui.notify(`Unable to find ${Config.FILE_PATH}. Please create ${Config.FILE_PATH}`, "warning");
    } else {
      ctx.ui.notify("Permissions extension loaded!\n", "info");
    }
  });

  pi.on("tool_call" as any, async (event: any, ctx: ExtensionContext) => {
    const cwd = process.cwd();
    ctx.ui.notify(`Current path: (${cwd})`, "info");

    const policies = config.load();
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
      if (!isPathAllowed(cwd, policies.paths)) {
        ctx.ui.notify(`Aborting: Current directory (${cwd}) not in allowed paths`, "error");
        ctx.abort();
        return;
      }
    } else {
      ctx.ui.notify(`Aborting: allowed paths empty or not proper format`, "error");
      ctx.abort();
      return;
    }

    if (policies.paths && policies.paths.length > 0) {
      if (!isPathAllowed(cwd, policies.paths)) {
        ctx.ui.notify(`Aborting: Current directory (${cwd}) not in allowed paths`, "error");
        ctx.abort();
        return true;
      }
    }

    let toolName: string;
    let fullCommand: string;
    let bashCmd: BashCommand;
    let policy: "allow" | "deny" | "ask" | string;

    ctx.ui.notify(`Tool: ${event.toolName}`, "info");
    
    toolName = event.toolName;
    fullCommand = "";
    bashCmd = { command: "", args: "" };
    if (event.toolName === "bash" && event.input.command && isBashCommand(event.input.command)) {
      bashCmd = extractBashCommand(event);
      fullCommand = bashCmd.args;
      toolName = bashCmd.command;
    }
    policy = getPolicy(policies, toolName);

    if (policy === "allow") return;

    if (policy === "ask") {
      const choice = await showPermissionDialog(ctx, `Permission request (${toolName})`, fullCommand);
      if (choice === "allow_once") {
        sendPermissionNotification(ctx, toolName, fullCommand, choice);
        return;
      } else if (choice === "allow_always") {
        sendPermissionNotification(ctx, toolName, fullCommand, choice);
        await config.addPath(ctx, pi, toolName);
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
  extractBashCommand,
  getPolicy,
  isPathAllowed,
  extractPathsFromCommand
};
