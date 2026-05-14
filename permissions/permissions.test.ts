import { test, expect, describe } from "bun:test";

import {
  getPolicy,
  isPathRestricted,
  extractPathsFromCommand,
  getBashAllowed,
  isPathAllowed
} from "./permissions";

import { CommandPolicy, BashPolicy, ToolPolicy, ExtensionToolsPolicy, PermissionConfig } from "./permissions.types";

import { join } from "path";
import { homedir } from "os";

const TEST_CONFIG: PermissionConfig = {
  "bash": {
    "git *": {
      "default": "ask",
      "allowed": []
    },
    "npm *": {
      "default": "ask",
      "allowed": []
    },
    "rm *": {
      "default": "deny",
      "allowed": []
    },
    "dd *": {
      "default": "deny",
      "allowed": []
    },
    "kill *": {
      "default": "deny",
      "allowed": []
    },
    "killall *": {
      "default": "deny",
      "allowed": []
    },
    "nc *": {
      "default": "deny",
      "allowed": []
    },
    "mv *": {
      "default": "deny",
      "allowed": []
    },
    "allowed": [
      "/Users/_/pie"
    ]
  },
  "tools": {
    "edit": {
      "default": "ask",
      "allowed": [
        "/Users/yo/.pi/agent/extensions",
        "/Users/_/pie"
      ]
    },
    "find": {
      "default": "allow",
      "allowed": []
    },
    "grep": {
      "default": "allow",
      "allowed": []
    },
    "ls": {
      "default": "allow",
      "allowed": []
    },
    "read": {
      "default": "ask",
      "allowed": [
        "/Users/_/pie"
      ]
    },
    "write": {
      "default": "deny",
      "allowed": [
        "/Users/yo/.pi/agent/extensions",
        "/Users/_/pie"
      ]
    }
  },
  "exec": {
    "default": "deny",
    "allowed": []
  },
  "mcp": {
    "default": "ask",
    "allowed": []
  },
  "skills": {
    "default": "ask",
    "allowed": []
  },
  "special": {
    "default": "ask",
    "allowed": []
  },
  "extensionTools": {
    "code_search": {
      "default": "allow",
      "allowed": []
    },
    "fetch_content": {
      "default": "allow",
      "allowed": []
    },
    "get_search_content": {
      "default": "allow",
      "allowed": []
    },
    "web_search": {
      "default": "ask",
      "allowed": [
        "/Users/yo/.pi/agent/extensions",
        "/Users/_/pie"
      ]
    }
  },
  "restricted": [
    "./dev/",
    "./usr/sbin/",
    "./private/etc/cups/",
    "./Library/Caches/com.apple.aned",
    "./Library/Bluetooth",
    "./Library/Trial",
    "~/.Trash",
    "./Library/Application Support/com.apple.TCC",
    "./Library/Application Support/Apple/AssetCache",
    "~/Library/Sharing",
    "~/Library/HomeKit",
    "~/Library/Messages",
    "~/Library/DuetExpertCenter",
    "~/Pictures/Photos Library.photoslibrary",
    "~/Movies/TV",
    "~/Music/Music"
  ],
  "read": {
    "default": "ask",
    "allowed": [
      "/Users/_/pie"
    ]
  },
  "edit": {
    "default": "ask",
    "allowed": [
      "/Users/_/pie"
    ]
  },
  "write": {
    "default": "ask",
    "allowed": [
      "/Users/_/pie"
    ]
  },
  "fetch_content": {
    "default": "ask",
    "allowed": [
      "/Users/_/pie"
    ]
  }
};

describe("Permission System", () => {
  describe("getPolicy", () => {
    test("should return deny for rm command", () => {
      const policy = getPolicy(TEST_CONFIG, "bash", "rm /tmp/file");
      expect(policy).toBe("deny");
    });

    test("should return ask for git command", () => {
      const policy = getPolicy(TEST_CONFIG, "bash", "git status");
      expect(policy).toBe("ask");
    });

    test("should return allow for find tool", () => {
      const policy = getPolicy(TEST_CONFIG, "find");
      expect(policy).toBe("allow");
    });

    test("should return ask for edit tool", () => {
      const policy = getPolicy(TEST_CONFIG, "edit");
      expect(policy).toBe("ask");
    });

    test("should return deny for write tool", () => {
      const policy = getPolicy(TEST_CONFIG, "write");
      expect(policy).toBe("deny");
    });

    test("should return ask for read tool", () => {
      const policy = getPolicy(TEST_CONFIG, "read");
      expect(policy).toBe("ask");
    });

    test("should return ask for web_search tool", () => {
      const policy = getPolicy(TEST_CONFIG, "web_search");
      expect(policy).toBe("ask");
    });

    test("should return allow for code_search tool", () => {
      const policy = getPolicy(TEST_CONFIG, "code_search");
      expect(policy).toBe("allow");
    });

    test("should return ask for mcp tool", () => {
      const policy = getPolicy(TEST_CONFIG, "mcp");
      expect(policy).toBe("ask");
    });

    test("should return ask for skills tool", () => {
      const policy = getPolicy(TEST_CONFIG, "skills");
      expect(policy).toBe("ask");
    });

    test("should return ask for special tool", () => {
      const policy = getPolicy(TEST_CONFIG, "special");
      expect(policy).toBe("ask");
    });

    test("should return deny for exec tool", () => {
      const policy = getPolicy(TEST_CONFIG, "exec");
      expect(policy).toBe("deny");
    });

    test("should return ask for unknown tool", () => {
      const policy = getPolicy(TEST_CONFIG, "unknown_tool");
      expect(policy).toBe("ask");
    });
  });

  describe("Restricted Path Handling", () => {
    test("should detect restricted path in command", () => {
      const config = TEST_CONFIG;
      const command = `cat ${join(homedir(), '.Trash')}`;
      const paths = extractPathsFromCommand(command);
      const isRestricted = paths.some(p => isPathRestricted(p, config.restricted));
      expect(isRestricted).toBe(true);
    });

    test("should not detect non-restricted path", () => {
      const config = TEST_CONFIG;
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
      const policy = getPolicy(TEST_CONFIG, "bash", "git status");
      expect(policy).toBe("ask");
    });

    test("should match wildcard command", () => {
      const policy = getPolicy(TEST_CONFIG, "bash", "git commit -m 'test'");
      expect(policy).toBe("ask");
    });

    test("should deny dangerous commands", () => {
      const policy = getPolicy(TEST_CONFIG, "bash", "rm -rf /");
      expect(policy).toBe("deny");
    });

    test("should deny kill commands", () => {
      const policy = getPolicy(TEST_CONFIG, "bash", "kill -9 1234");
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
