import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PermissionConfig, PermissionChoice, Policy } from "./types";

export class Manager {

  getPolicy(config: PermissionConfig, toolName: string): Policy {
    if (config.deny?.includes(toolName)) {
      return "deny";
    }
    else if (config.ask?.includes(toolName)) {
      return "ask";
    }
    else if (config.allow?.includes(toolName)) {
      return "allow";
    } 
    else {
      return "deny";
    }
  }
  
  async showPermissionDialog(
    ctx: ExtensionContext,
    action: string,
    resource: string
  ): Promise<PermissionChoice> {
    if (ctx.hasUI) {
      const options = ["Allow", "Reject"];
      const choice = await ctx.ui.select(`! ${action}: ${resource}`, options);
      if (choice === options[0]) return "allow";
      return "reject";
    }
    return "reject";
  }

  sendPermissionNotification(
    ctx: ExtensionContext,
    toolName: string,
    cmd: string,
    decision: PermissionChoice
  ): void {
  
    const statusMessage = decision === "reject" ? "Rejected" : "Allow";
  
    let toolNotice = "";
    
    if (toolName === "bash") {
      toolNotice = `${statusMessage} Permission request (${toolName}) tool command: ${cmd}`;
    } else {
      toolNotice = `${statusMessage} Permission request (${toolName}) tool`;
    }
  
    ctx.ui.notify(toolNotice, decision === "reject" ? "error" : "info");
  }

  async debug(
    step: string,
    ctx: ExtensionContext,
    policies: PermissionConfig
  ): Promise<void> {
    const msg: string = `LOG step: ${step}\nLOG ask: ${policies.ask}\nLOG allow: ${policies.allow}\nLOG deny: ${policies.deny}\nLOG path: ${policies.paths}`
    ctx.ui.notify(msg, "info");
    const options = ["Allow", "Reject"];
    const choice = await ctx.ui.select(`! esc to continue`, []);
  }
}
