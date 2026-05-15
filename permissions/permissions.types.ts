export interface PermissionConfig {
  ask?: string[];
  allow?: string[];
  deny?: string[];
  paths?: string[];
  error?: {};
}

export interface ToolCallEvent {
  toolName: string;
  input: { command: string };
}

export interface SendOptions {
  triggerTurn: boolean;
  deliverAs: string;
}