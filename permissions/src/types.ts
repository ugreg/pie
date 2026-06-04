export type PermissionChoice = "allow" | "reject";
export type Policy = "allow" | "deny" | "ask" | string;

export interface PermissionConfig {
  ask?: string[];
  allow?: string[];
  deny?: string[];
  paths?: string[];
  error?: {};
}

export interface ToolCall {
  name: string;
  command: string;
  bashCommands?: string[];
  bashPaths?: string[];
}
