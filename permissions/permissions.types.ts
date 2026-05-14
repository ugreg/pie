interface PermissionConfig {
  ask?: string[];
  allow?: string[];
  deny?: string[];
  paths?: string[];
  error?: string;
}

interface ToolCallEvent {
  toolName: string;
  input: { command: string };
}

interface SendOptions {
  triggerTurn: boolean;
  deliverAs: string;
}