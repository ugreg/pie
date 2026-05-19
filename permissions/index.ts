import { homedir } from "os";
import { existsSync } from "fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { Config, Manager } from "./src";

import {
  PermissionConfig,
  ToolCallEvent,
  SendOptions } from "./src/types";

export default function (pi: ExtensionAPI) {
  const config = new Config();
  pi.on("session_start", async (_event, ctx) => {
    if (!existsSync(Config.FILE_PATH)) {
      ctx.ui.notify(`\nPi Permissions lite - required file ${Config.FILE_PATH} not found. Please create it.`, "error");
    } else {
      ctx.ui.notify("Pi Permissions lite extension loaded!\n", "info");
    }
  });

  const manager = new Manager();
  pi.on("tool_call" as any, async (event: any, ctx: ExtensionContext) => {
    const cwd = process.cwd();
    ctx.ui.notify(`Current path: (${cwd})`, "info");
    const policies = config.load();
    config.verify(ctx, policies);
    if (policies.paths && policies.paths.length > 0) {
      if (!manager.isPathAllowed(cwd, policies.paths)) {
        ctx.ui.notify(`Aborting: Current directory (${cwd}) not in allowed paths`, "error");
        ctx.abort();
        return true;
      }
    }

    let toolName: string;
    let fullCommand: string;
    let policy: "allow" | "deny" | "ask" | string;
    ctx.ui.notify(`Tool: ${event.toolName}`, "info");
    await manager.debug("before check bash", ctx, policies);
    toolName = event.toolName;
    fullCommand = "undefined";
    if (event.toolName === "bash" && event.input.command) {
      fullCommand = event.input.command;
      toolName = event.input.command.split(" ")[0];;
    }
    await manager.debug(`tool '${toolName}'`, ctx, policies);
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
