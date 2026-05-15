import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import {
  getPolicy,
  loadConfig,
  isPathAllowed,
  extractPathsFromCommand,
  checkPermission
} from "./permissions";

import { PermissionConfig } from "./permissions.types";

const TEST_CONFIG: PermissionConfig = {
  ask: ["edit", "write", "mcp", "skills", "special", "read", "web_search"],
  allow: ["find", "grep", "ls", "code_search", "fetch_content", "get_search_content"],
  deny: ["npm ", "rm ", "dd ", "kill ", "killall ", "nc ", "mv "],
  paths: ["/Users/yo/.Trash", "/Users/yo/.pi/agent/extensions", "/Users/_/pie"]
};

describe("Permission System", () => {

  describe("File io", () => {
    test("should access permissions file in expected path", () => {
      const config = loadConfig();
      expect(config).not.toBeNull();
      expect(config).not.toHaveProperty('error');
    });
  });

  describe("getPolicy", () => {
    test("should return deny for rm command", () => {
      const config = TEST_CONFIG;
      const policy = getPolicy(config, "bash", "rm /tmp/file");
      expect(policy).toBe("deny");
    });

    test("should return allow for find tool", () => {
      const config = TEST_CONFIG;
      const policy = getPolicy(config, "find");
      expect(policy).toBe("allow");
    });

    test("should return ask for edit tool", () => {
      const config = TEST_CONFIG;
      const policy = getPolicy(config, "edit");
      expect(policy).toBe("ask");
    });

    test("should return ask for write tool", () => {
      const config = TEST_CONFIG;
      const policy = getPolicy(config, "write");
      expect(policy).toBe("ask");
    });

    test("should return ask for web_search tool", () => {
      const config = TEST_CONFIG;
      const policy = getPolicy(config, "web_search");
      expect(policy).toBe("ask");
    });

    test("should return allow for code_search tool", () => {
      const config = TEST_CONFIG;
      const policy = getPolicy(config, "code_search");
      expect(policy).toBe("allow");
    });

    test("should return ask for mcp tool", () => {
      const config = TEST_CONFIG;
      const policy = getPolicy(config, "mcp");
      expect(policy).toBe("ask");
    });

    test("should return ask for skills tool", () => {
      const config = TEST_CONFIG;
      const policy = getPolicy(config, "skills");
      expect(policy).toBe("ask");
    });

    test("should return ask for unknown tool", () => {
      const config = TEST_CONFIG;
      const policy = getPolicy(config, "unknown_tool");
      expect(policy).toBe("deny");
    });
  });

  describe("Path Allowed Checking", () => {
    test("should detect allowed path", () => {
      const config = TEST_CONFIG;
      const isAllowed = isPathAllowed("/Users/_/pie", config.paths);
      expect(isAllowed).toBe(true);
    });

    test("should detect allowed child path", () => {
      const config = TEST_CONFIG;
      const isAllowed = isPathAllowed("/Users/_/pie/permissions", config.paths);
      expect(isAllowed).toBe(true);
    });

    test("should detect non-allowed path", () => {
      const config = TEST_CONFIG;
      const isAllowed = isPathAllowed("/Users/other/path", config.paths);
      expect(isAllowed).toBe(false);
    });
  });

  describe("Tools Object Handling", () => {
    test("should get policy from allow array", () => {
      const config: PermissionConfig = {
        paths: [],
        allow: ["edit", "read"]
      };
      
      expect(getPolicy(config, "edit")).toBe("allow");
      expect(getPolicy(config, "read")).toBe("allow");
    });

    test("should get policy from extensionTools array", () => {
      const config: PermissionConfig = {
        paths: [],
        allow: ["web_search", "code_search"]
      };
      
      expect(getPolicy(config, "web_search")).toBe("allow");
      expect(getPolicy(config, "code_search")).toBe("allow");
    });

    test("should fallback to legacy properties", () => {
      const config: PermissionConfig = {
        paths: [],
        ask: ["edit", "write"]
      };
      
      expect(getPolicy(config, "edit")).toBe("ask");
      expect(getPolicy(config, "write")).toBe("ask");
    });
  });
});
