export interface PermissionConfig {
  ask?: string[];
  allow?: string[];
  deny?: string[];
  paths?: string[];
  error?: {};
}

export type PermissionChoice = "allow" | "reject";

export type Policy = "allow" | "deny" | "ask" | string;

export interface SendOptions {
  triggerTurn: boolean;
  deliverAs: string;
}
