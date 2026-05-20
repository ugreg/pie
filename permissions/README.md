# About

```
π (tool) - ⌘ (extension) - ✔ Check policy
                               :
                      (deny > ask > allow)
                        :      :      :
                        x      ?      o
```

Deterministic permission gates for pi [built-in tools](https://pi.dev/docs/latest/extensions#overriding-built-in-tools), bash commands, and other operations.

By default, [pi runs in full YOLO mode](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/#toc_13) if you do not have this extension installed and assumes you know what you're doing. It has unrestricted access to your filesystem and can execute any command without permission checks or safety rails. No permission prompts for file operations or commands. No pre-checking of bash commands by Haiku for malicious content. Full filesystem access. Can execute any command with your user privileges.

> [!NOTE]
> [Inspired by pi-permission-system](https://github.com/MasuRii/pi-permission-system), here is it's [extension page](https://pi.dev/packages/@gotgenes/pi-permission-system?name=permission).


# Setup
```
pi install npm:@ugreg/pi-agent-permission-system-lite
```

Create a config file ` ~/.pi/permissions.json` using the structure from `permissions.example.json`. Updates to the config are pulled in automtically into your current and future sessions.

> [!CAUTION]
> Pi packages can execute code and influence agent behavior.
> Review the source before installing third-party packages.
