import { homedir } from "os";
import { existsSync } from "fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PermissionConfig, BashCommand } from "./types";

export class Manager {

  isBashCommand(cmd: string): boolean {
    if (cmd.endsWith(" *")) {
      const prefix = cmd.slice(0, -2);
      return cmd.startsWith(prefix + " ");
    }
  
    return false;
  }
  
  extractBashCommand(event: any): BashCommand {
    let bc: BashCommand = { command: "", args: "" };
    bc.command = event.input.command;
    bc.args = event.input.command.split(" ")[0];
  
    return bc;
  }
  
  isPathAllowed(path: string, allowed: string[] | undefined): boolean {
    const normalized = path.replace(/\\/g, "/");
    const home = homedir();
    return (allowed ?? []).some((allowedPath) => {
      const resolved = allowedPath.replace("~", home);
      return normalized === resolved || normalized.startsWith(resolved + "/");
    });
  }
  
  extractPathsFromCommand(cmd: string): string[] {
    const paths: string[] = [];
    const regex = /["']([^"']+)["']|(?:\/[^\s]+)+/g;
    let match;
    while ((match = regex.exec(cmd)) !== null) {
      paths.push(match[1] || match[0]);
    }
    return paths;
  }
  
  getPolicy(config: PermissionConfig, toolName: string): "allow" | "deny" | "ask" {
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
  
  async showPermissionDialog(
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
  sendPermissionNotification(
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
}
