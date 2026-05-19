import { homedir } from "os";
import { existsSync } from "fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { Config, Manager } from "./src";

import {
  PermissionConfig,
  SendOptions,
  PermissionChoice,
  Policy } from "./src/types";

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
    config.verify(ctx, policies, cwd);
    let toolName: string;
    let fullCommand: string;
    let policy: Policy;
    let choice: PermissionChoice;
    ctx.ui.notify(`Tool: ${event.toolName}`, "info");
    // await manager.debug("before check bash", ctx, policies);
    toolName = event.toolName;
    fullCommand = "undefined";
    if (event.toolName === "bash" && event.input.command) {
      fullCommand = event.input.command;
      toolName = event.input.command.split(" ")[0];;
    }
    // await manager.debug(`tool '${toolName}'`, ctx, policies);
    policy = manager.getPolicy(policies, toolName);
    switch (policy) {
      case "allow":
        return;
      case "ask": {
        choice = await manager.showPermissionDialog(
          ctx,
          `Permission request (${toolName})`,
          fullCommand
        );
        if (choice === "allow") {
          manager.sendPermissionNotification(ctx, toolName, fullCommand, choice);
          return;
        } else {
          ctx.abort();
          return;
        }
      }
      case "deny":
        manager.sendPermissionNotification(ctx, toolName, fullCommand, "reject");
        ctx.abort();
        return;
    }
  });
}
