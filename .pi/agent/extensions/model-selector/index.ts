import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SelectorState } from "./state.js";
import { ModelSelectorComponent } from "./component.js";

export default function (pi: ExtensionAPI) {
  const state = new SelectorState();

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.model) {
      ctx.ui.setStatus("model-ext", `🤖 ${ctx.model.id}`);
    }
  });

  pi.on("model_select", async (event, ctx) => {
    const { model } = event;
    if (model) {
      ctx.ui.setStatus("model-ext", `🤖 ${model.id}`);
    }
  });

  function openSelector(ctx: any, initialSearch?: string) {
    return ctx.ui.custom(
      (tui: any, theme: any, _keybindings: any, done: any) => {
        return new ModelSelectorComponent({
          tui,
          theme,
          currentModel: ctx.model,
          modelRegistry: ctx.modelRegistry,
          state,
          onSelect: async (model: any) => {
            const ok = await pi.setModel(model);
            if (!ok) {
              ctx.ui.notify(`No API key for ${model.provider}`, "error");
            } else {
              ctx.ui.notify(`Model: ${model.id}`, "info");
            }
            done(undefined);
          },
          onCancel: () => {
            done(undefined);
          },
          initialSearch,
        });
      },
      {
        overlay: true,
        overlayOptions: {
          width: "60%",
          minWidth: 52,
          maxHeight: 18,
          anchor: "center",
          row: "50%",
        },
      },
    );
  }

  pi.registerCommand("mdls", {
    description: "Open enhanced model selector",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Model selector requires interactive mode", "error");
        return;
      }
      const search = args?.trim() || undefined;
      await openSelector(ctx, search);
    },
  });

  pi.registerShortcut("ctrl+x", {
    description: "Open enhanced model selector",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openSelector(ctx);
    },
  });
}
