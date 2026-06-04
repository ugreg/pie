import { existsSync } from "fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { Config, Manager } from "./src";

export default function (pi: ExtensionAPI) {
  const config = new Config();
  pi.on("session_start", async (_event, ctx) => {
    if (!existsSync(Config.FILE_PATH)) {
      ctx.ui.notify(`\nPi Permissions lite ERROR: required file ${Config.FILE_PATH} not found. Please create it.`, "error");
    } else {
      ctx.ui.notify("Pi Permissions lite extension loaded!\n", "info");
    }
  });

  const manager = new Manager();
  pi.on("tool_call" as any, async (event: any, ctx: ExtensionContext) => {
    const cwd = process.cwd();
    ctx.ui.notify(`Current path: (${cwd})`, "info");
    const permissions = config.load();
    config.verify(ctx, permissions, cwd);
    await manager.process(ctx, permissions, event);
  });
}
