import { test, expect, describe } from "bun:test";

import {
  getPolicy,
  loadConfig,
  isPathRestricted,
  extractPathsFromCommand,
  getBashAllowed,
  isPathAllowed
} from "./permissions";

import { CommandPolicy, BashPolicy, ToolPolicy, ExtensionToolsPolicy, PermissionConfig } from "./permissions.types";

describe("Permission System", () => {
  describe("getPolicy", () => {
    test("should return deny for rm command", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "bash", "rm /tmp/file");
      expect(policy).toBe("deny");
    });

    test("should return ask for git command", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "bash", "git status");
      expect(policy).toBe("ask");
    });

    test("should return allow for find tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "find");
      expect(policy).toBe("allow");
    });

    test("should return ask for edit tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "edit");
      expect(policy).toBe("ask");
    });

    test("should return deny for write tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "write");
      expect(policy).toBe("deny");
    });

    test("should return ask for read tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "read");
      expect(policy).toBe("ask");
    });

    test("should return ask for web_search tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "web_search");
      expect(policy).toBe("ask");
    });

    test("should return allow for code_search tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "code_search");
      expect(policy).toBe("allow");
    });

    test("should return ask for mcp tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "mcp");
      expect(policy).toBe("ask");
    });

    test("should return ask for skills tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "skills");
      expect(policy).toBe("ask");
    });

    test("should return ask for special tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "special");
      expect(policy).toBe("ask");
    });

    test("should return deny for exec tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "exec");
      expect(policy).toBe("deny");
    });

    test("should return ask for unknown tool", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "unknown_tool");
      expect(policy).toBe("ask");
    });
  });

  describe("Restricted Path Handling", () => {
    test("should detect restricted path in command", () => {
      const config = loadConfig();
      const command = "cat /Users/yo/.Trash/file.txt";
      const paths = extractPathsFromCommand(command);
      const isRestricted = paths.some(p => isPathRestricted(p, config.restricted));
      expect(isRestricted).toBe(true);
    });

    test("should not detect non-restricted path", () => {
      const config = loadConfig();
      const command = "cat /Users/_/pie/file.txt";
      const paths = extractPathsFromCommand(command);
      const isRestricted = paths.some(p => isPathRestricted(p, config.restricted));
      expect(isRestricted).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("should handle missing config gracefully", () => {
      const config: PermissionConfig = { restricted: [] };
      const policy = getPolicy(config, "edit");
      expect(policy).toBe("ask");
    });

    test("should handle ill-formatted JSON gracefully", () => {
      const config: PermissionConfig = { restricted: [] };
      const policy = getPolicy(config, "edit");
      expect(policy).toBe("ask");
    });
  });

  describe("Bash Command Matching", () => {
    test("should match exact command", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "bash", "git status");
      expect(policy).toBe("ask");
    });

    test("should match wildcard command", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "bash", "git commit -m 'test'");
      expect(policy).toBe("ask");
    });

    test("should deny dangerous commands", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "bash", "rm -rf /");
      expect(policy).toBe("deny");
    });

    test("should deny kill commands", () => {
      const config = loadConfig();
      const policy = getPolicy(config, "bash", "kill -9 1234");
      expect(policy).toBe("deny");
    });
  });

  describe("Tools Object Handling", () => {
    test("should get policy from tools object", () => {
      const config: PermissionConfig = {
        restricted: [],
        tools: {
          edit: { default: "allow", allowed: [] },
          read: { default: "deny", allowed: [] }
        }
      };
      
      expect(getPolicy(config, "edit")).toBe("allow");
      expect(getPolicy(config, "read")).toBe("deny");
    });

    test("should get policy from extensionTools object", () => {
      const config: PermissionConfig = {
        restricted: [],
        extensionTools: {
          web_search: { default: "allow", allowed: [] },
          code_search: { default: "deny", allowed: [] }
        }
      };
      
      expect(getPolicy(config, "web_search")).toBe("allow");
      expect(getPolicy(config, "code_search")).toBe("deny");
    });

    test("should fallback to legacy properties", () => {
      const config: PermissionConfig = {
        restricted: [],
        edit: { default: "allow", allowed: [] },
        write: { default: "deny", allowed: [] }
      };
      
      expect(getPolicy(config, "edit")).toBe("allow");
      expect(getPolicy(config, "write")).toBe("deny");
    });
  });
});
