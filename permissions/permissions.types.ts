// Permission system type definitions

export interface CommandPolicy {
  default: "allow" | "deny" | "ask";
  allowed: string[];
}

export interface BashPolicy {
  [commandPattern: string]: CommandPolicy;
}

export interface ToolPolicy {
  default: "allow" | "deny" | "ask";
  allowed: string[];
}

export interface ExtensionToolsPolicy {
  [toolName: string]: ToolPolicy;
}

export interface PermissionConfig {
  restricted: string[];
  [key: string]: string[] | string | ExtensionToolsPolicy | ToolPolicy | BashPolicy | undefined;
  
  bash?: BashPolicy;
  tools?: ExtensionToolsPolicy;
  exec?: ToolPolicy;
  mcp?: ToolPolicy;
  skills?: ToolPolicy;
  special?: ToolPolicy;
  extensionTools?: ExtensionToolsPolicy;
}
