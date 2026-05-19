# About

```
pi agent --> tool call --> plugin intercept
                          |
                          v
                      load ~/.pi/permissions.json
                          |
                          v
                      check cwd in allowed paths
                          |
                          v
                      determine policy (deny > ask > allow)
                          |
                          v
                      execute, prompt user, or abort
```

Deterministic permission gates for [built-in tools](https://pi.dev/docs/latest/extensions#overriding-built-in-tools), bash commands, and other operations used in [pi coding agent](https://pi.dev/) by [Mario Zechner](https://mariozechner.at/).

By default, [pi runs in full YOLO mode](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/#toc_13) if you do not have this extension installed and assumes you know what you're doing. It has unrestricted access to your filesystem and can execute any command without permission checks or safety rails. No permission prompts for file operations or commands. No pre-checking of bash commands by Haiku for malicious content. Full filesystem access. Can execute any command with your user privileges.

# Setup

```
pi install npm:@ugreg/pi-agent-permission-system-lite
```

Create a config file ` ~/.pi/permissions.json` using the structure from `permissions.example.json`.

# SECURITY NOTE

Pi packages can execute code and influence agent behavior. Review the source before installing third-party packages.

[Inspired by pi-permission-system](https://github.com/MasuRii/pi-permission-system), here is it's [extension page](https://pi.dev/packages/@gotgenes/pi-permission-system?name=permission).
