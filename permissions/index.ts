import { homedir } from "os";
import { existsSync } from "fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { Config, Manager } from "./src";

import { 
  BashCommand, 
  PermissionConfig, 
  ToolCallEvent, 
  SendOptions } from "./src/types";

export default function (pi: ExtensionAPI) {
  const config = new Config();
  pi.on("session_start", async (_event, ctx) => {
    if (!existsSync(Config.FILE_PATH)) {
      ctx.ui.notify(`Unable to find ${Config.FILE_PATH}. Please create ${Config.FILE_PATH}`, "warning");
    } else {
      ctx.ui.notify("Permissions extension loaded!\n", "info");
    }
  });

  const manager = new Manager();
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

    if (policies.paths && policies.paths.length > 0) {
      if (!manager.isPathAllowed(cwd, policies.paths)) {
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

    await manager.debug("before check bash", ctx, policies);

    toolName = event.toolName;
    fullCommand = "";
    bashCmd = { command: "", args: "" };

    await manager.debug(`checked bash on command '${event.input.command}'`, ctx, policies);

    if (event.toolName === "bash" && event.input.command && manager.isBashCommand(event.input.command)) {
      bashCmd = manager.extractBashCommand(event);
      fullCommand = bashCmd.args;
      toolName = bashCmd.command;
    }

    policy = manager.getPolicy(policies, toolName);

    if (policy === "allow") return;

    if (policy === "ask") {
      const choice = await manager.showPermissionDialog(ctx, `Permission request (${toolName})`, fullCommand);
      if (choice === "allow_once") {
        manager.sendPermissionNotification(ctx, toolName, fullCommand, choice);
        return;
      } else if (choice === "allow_always") {
        manager.sendPermissionNotification(ctx, toolName, fullCommand, choice);
        await config.addPath(ctx, pi, toolName);
        return;
      } else {
        ctx.abort();
      }
    }

    if (policy === "deny") {
      manager.sendPermissionNotification(ctx, toolName, fullCommand, "reject");
      ctx.abort();
    }
  });
}
