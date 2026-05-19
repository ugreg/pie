import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  PermissionConfig,
  PermissionChoice,
  Policy,
  ToolCall 
} from "./types";

export class Manager {

  async process(ctx: ExtensionContext, permissions: PermissionConfig, toolCall: ToolCall): Promise<void> {
    let policy: Policy;
    let choice: PermissionChoice;
    policy = this.getPolicy(permissions, toolCall.name);
    switch (policy) {
      case "allow":
        return;
      case "ask": {
        choice = await this.showPermissionDialog(
          ctx,
          `Permission request (${toolCall.name})`,
          toolCall.command
        );
        if (choice === "allow") {
          this.sendPermissionNotification(ctx, toolCall.name, toolCall.command, choice);
          return;
        } else {
          ctx.abort();
          return;
        }
      }
      case "deny":
        this.sendPermissionNotification(ctx, toolCall.name, toolCall.command, "reject");
        ctx.abort();
        return;
    }
  }
  
  getPolicy(permissions: PermissionConfig, toolName: string): Policy {
    if (permissions.deny?.includes(toolName)) {
      return "deny";
    }
    else if (permissions.ask?.includes(toolName)) {
      return "ask";
    }
    else if (permissions.allow?.includes(toolName)) {
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
  }
}
