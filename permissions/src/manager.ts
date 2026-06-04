import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  PermissionConfig,
  PermissionChoice,
  Policy,
  ToolCall 
} from "./types";

export class Manager {

  async checkPolicy(ctx: ExtensionContext, toolCall: ToolCall, policy: Policy): Promise<void> {
    let choice: PermissionChoice;
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

  async process(ctx: ExtensionContext, permissions: PermissionConfig, event: any): Promise<void> {
    let policy: Policy;
    let toolCall: ToolCall = { name: "", command: "" };
    let res: Map<string, string> = new Map();
    
    toolCall.name = event.toolName;
    if (event.toolName === "bash" && event.input.command) {
      toolCall.name = event.input.command.split(" ")[0];
      toolCall.command = event.input.command;
      res = await this.extractCommands(toolCall.command, permissions);
      this.debug(`initial map result ${JSON.stringify(Object.fromEntries(res), null, 2)}`, ctx, permissions);
      // also process paths used in larger run commands like $ cd /Users/yo/Downloads/rems && for f in *.gb; do
      for (const [command, policy] of res) {
        toolCall.bashCommands?.push(command);
        if (policy === "deny") {
          this.sendPermissionNotification(ctx, "bash", command, "reject");
          ctx.abort();
          return;
        }
      }
      this.debug(`checking bash arry ${toolCall.bashCommands?.join(", ")}`, ctx, permissions);
      for (const item of toolCall.bashCommands ?? []) {
        let subTool: ToolCall = { name: "bash", command: item };
        policy = this.getPolicy(permissions, item);
        this.checkPolicy(ctx, subTool, policy);
      }
    }
    policy = this.getPolicy(permissions, toolCall.name);
    this.checkPolicy(ctx, toolCall, policy)
  }

  async extractCommands(text: string, config: PermissionConfig): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    let tool;
    let policy: string = "none";
    for (const match of text.matchAll(/(?:^|\s|&&|\|)\s*(\w+)/g)) {
      for (const [cat, cmds] of Object.entries(config)) {
        if (cmds?.includes(match[1])) {
          tool = cat;
        }
      }
      if (tool && !results.has(match[1])) {
        tool = match[1];
        policy = this.getPolicy(config, tool);
        if (policy != "desconocido") {
          results.set(match[1], policy);
        }
      }
    }
    return results;
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
      return "desconocido";
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
    policies?: PermissionConfig,
    toolCall?: ToolCall
  ): Promise<void> {
    const ask = policies?.ask?.join(', ') || 'ask none';
    const allow = policies?.allow?.join(', ') || 'allow none';
    const deny = policies?.deny?.join(', ') || 'deny none';
    const paths = policies?.paths?.join(', ') || 'paths none';
    let msg: string = `LOG step: ${step}\nLOG ask: ${ask}\nLOG allow: ${allow}\nLOG deny: ${deny}\nLOG path: ${paths}}`
    ctx.ui.notify(msg, "info");
    ctx.ui.notify("----------------------------", "warning");
  }
}
