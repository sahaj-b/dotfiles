import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fuzzyFilter, Input, matchesKey, type TUI, visibleWidth } from "@earendil-works/pi-tui";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ─── State ──────────────────────────────────────────────────────────────────

const STATE_FILE = path.join(os.homedir(), ".pi", "model-selector.json");

interface SelectorStateData {
  favorites: string[];
  hiddenProviders: string[];
  recentSelections: Record<string, number>;
}

class SelectorState {
  private data: SelectorStateData;

  constructor() {
    this.data = this.load();
  }

  private load(): SelectorStateData {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
          hiddenProviders: Array.isArray(parsed.hiddenProviders) ? parsed.hiddenProviders : [],
          recentSelections:
            parsed.recentSelections && typeof parsed.recentSelections === "object"
              ? parsed.recentSelections
              : {},
        };
      }
    } catch {
      // corrupt or unreadable — start fresh
    }
    return { favorites: [], hiddenProviders: [], recentSelections: {} };
  }

  private save(): void {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.data, null, 2), "utf-8");
  }

  get favorites(): ReadonlyArray<string> {
    return this.data.favorites;
  }

  get hiddenProviders(): ReadonlyArray<string> {
    return this.data.hiddenProviders;
  }

  isFavorited(provider: string, id: string): boolean {
    return this.data.favorites.includes(`${provider}/${id}`);
  }

  isProviderHidden(provider: string): boolean {
    return this.data.hiddenProviders.includes(provider);
  }

  toggleFavorite(provider: string, id: string): void {
    const key = `${provider}/${id}`;
    const idx = this.data.favorites.indexOf(key);
    if (idx >= 0) {
      this.data.favorites.splice(idx, 1);
    } else {
      this.data.favorites.unshift(key);
    }
    this.save();
  }

  toggleProviderHidden(provider: string): void {
    const idx = this.data.hiddenProviders.indexOf(provider);
    if (idx >= 0) {
      this.data.hiddenProviders.splice(idx, 1);
    } else {
      this.data.hiddenProviders.push(provider);
    }
    this.save();
  }

  recordSelection(provider: string, id: string): void {
    this.data.recentSelections[`${provider}/${id}`] = Date.now();
    this.save();
  }

  getRecentTimestamp(provider: string, id: string): number {
    return this.data.recentSelections[`${provider}/${id}`] ?? 0;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

const PINK = "\x1b[38;2;255;182;193m";
const RESET_FG = "\x1b[39m";

interface ModelItem {
  provider: string;
  id: string;
  model: Model<any>;
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000)
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return `${tokens}`;
}

interface ModelSelectorComponentOptions {
  tui: TUI;
  theme: any;
  currentModel: Model<any> | undefined;
  modelRegistry: any;
  state: SelectorState;
  onSelect: (model: Model<any>) => void;
  onCancel: () => void;
  initialSearch?: string;
}

class ModelSelectorComponent {
  private tui: TUI;
  private theme: any;
  private currentModel: Model<any> | undefined;
  private modelRegistry: any;
  private state: SelectorState;
  private onSelect: (model: Model<any>) => void;
  private onCancel: () => void;

  private searchInput: Input;
  private allModels: ModelItem[] = [];
  private filteredModels: ModelItem[] = [];
  private selectedIndex = 0;
  private errorMessage?: string;
  private loaded = false;

  constructor(opts: ModelSelectorComponentOptions) {
    this.tui = opts.tui;
    this.theme = opts.theme;
    this.currentModel = opts.currentModel;
    this.modelRegistry = opts.modelRegistry;
    this.state = opts.state;
    this.onSelect = opts.onSelect;
    this.onCancel = opts.onCancel;

    this.searchInput = new Input();
    if (opts.initialSearch) {
      this.searchInput.setValue(opts.initialSearch);
    }
    this.searchInput.onSubmit = () => {
      if (this.filteredModels[this.selectedIndex]) {
        this.handleSelect(this.filteredModels[this.selectedIndex].model);
      }
    };

    this.loadModels().then(() => {
      this.loaded = true;
      if (opts.initialSearch) {
        this.filterModels(opts.initialSearch);
      } else {
        this.updateFilteredModels();
      }
      this.tui.requestRender();
    });
  }

  private async loadModels(): Promise<void> {
    this.modelRegistry.refresh();
    const loadError = this.modelRegistry.getError?.();
    if (loadError) {
      this.errorMessage = loadError;
    }
    try {
      const available = await this.modelRegistry.getAvailable();
      this.allModels = this.sortModels(
        available.map((m: Model<any>) => ({ provider: m.provider, id: m.id, model: m })),
      );
    } catch (error) {
      this.allModels = [];
      this.filteredModels = [];
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  private sortModels(models: ModelItem[]): ModelItem[] {
    return [...models].sort((a, b) => {
      const aFav = this.state.isFavorited(a.provider, a.id);
      const bFav = this.state.isFavorited(b.provider, b.id);
      if (aFav !== bFav) return aFav ? -1 : 1;
      const aTime = this.state.getRecentTimestamp(a.provider, a.id);
      const bTime = this.state.getRecentTimestamp(b.provider, b.id);
      if (aTime !== bTime) return bTime - aTime;
      return a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id);
    });
  }

  private filterModels(query: string): void {
    this.filteredModels = query
      ? fuzzyFilter(this.allModels, query, ({ id, provider }) => `${id} ${provider} ${provider}/${id}`)
      : [...this.allModels];
    this.filteredModels = this.filteredModels.filter(
      (item) => !this.state.isProviderHidden(item.provider),
    );
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredModels.length - 1));
    this.tui.requestRender();
  }

  private updateFilteredModels(): void {
    this.filteredModels = this.allModels.filter(
      (item) => !this.state.isProviderHidden(item.provider),
    );
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredModels.length - 1));
  }

  private refreshAfterStateChange(sel: ModelItem): void {
    this.allModels = this.sortModels(this.allModels);
    const searchQuery = this.searchInput.getValue();
    if (searchQuery) {
      this.filterModels(searchQuery);
    } else {
      this.updateFilteredModels();
    }
    const curIdx = this.filteredModels.findIndex(
      (item) => item.provider === sel.provider && item.id === sel.id,
    );
    if (curIdx >= 0) this.selectedIndex = curIdx;
    this.tui.requestRender();
  }

  private handleSelect(model: Model<any>): void {
    this.state.recordSelection(model.provider, model.id);
    this.onSelect(model);
  }

  private isCurrentModel(model: Model<any>): boolean {
    return (
      !!this.currentModel &&
      this.currentModel.provider === model.provider &&
      this.currentModel.id === model.id
    );
  }

  render(width: number): string[] {
    const lines: string[] = [];
    const innerWidth = width - 4;

    lines.push(this.boxTop(innerWidth));

    const searchLabel = this.theme.fg("muted", "\uf002 ");
    const searchRender = this.searchInput.render(innerWidth - visibleWidth(searchLabel) - 2);
    let searchContent = searchRender[0] ?? "";
    if (searchContent.startsWith("> ")) searchContent = searchContent.slice(2);
    lines.push(this.boxLine(` ${searchLabel}${searchContent} `, innerWidth));
    lines.push(this.boxSep(innerWidth));

    if (!this.loaded) {
      lines.push(this.boxLine(this.theme.fg("muted", "  loading..."), innerWidth));
      lines.push(this.boxBottom(innerWidth));
      return lines;
    }

    if (this.errorMessage) {
      for (const l of this.errorMessage.split("\n")) {
        lines.push(this.boxLine(this.theme.fg("error", `  ${l}`), innerWidth));
      }
      lines.push(this.boxBottom(innerWidth));
      return lines;
    }

    const maxVisible = Math.min(10, this.filteredModels.length);
    const startIdx = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(maxVisible / 2),
        this.filteredModels.length - maxVisible,
      ),
    );
    const endIdx = Math.min(startIdx + maxVisible, this.filteredModels.length);

    for (let i = startIdx; i < endIdx; i++) {
      const item = this.filteredModels[i];
      if (!item) continue;
      const line = this.renderModelLine(
        item,
        i === this.selectedIndex,
        this.isCurrentModel(item.model),
        this.state.isFavorited(item.provider, item.id),
        innerWidth,
      );
      lines.push(this.boxLine(line, innerWidth));
    }

    if (startIdx > 0 || endIdx < this.filteredModels.length) {
      lines.push(
        this.boxLine(
          this.theme.fg("muted", `  (${this.selectedIndex + 1}/${this.filteredModels.length})`),
          innerWidth,
        ),
      );
    }

    const totalHidden = this.allModels.filter((m) =>
      this.state.isProviderHidden(m.provider)
    ).length;
    if (this.filteredModels.length > 0) {
      const sel = this.filteredModels[this.selectedIndex];
      const nameText = sel ? this.theme.fg("muted", `  ${sel.model.name}`) : "";
      if (totalHidden > 0) {
        const hiddenText = this.theme.fg(
          "muted",
          ` ${this.state.hiddenProviders.join(", ")} (${totalHidden})`,
        );
        const combined = `${nameText}${" ".repeat(Math.max(1, innerWidth - visibleWidth(nameText) - visibleWidth(hiddenText)))}${hiddenText}`;
        lines.push(this.boxLine(combined, innerWidth));
      } else if (nameText) {
        lines.push(this.boxLine(nameText, innerWidth));
      }
    } else {
      lines.push(this.boxLine(this.theme.fg("muted", "  no matching models"), innerWidth));
    }

    lines.push(this.boxBottom(innerWidth));

    return lines;
  }

  private renderModelLine(
    item: ModelItem,
    selected: boolean,
    isCurrent: boolean,
    isFav: boolean,
    innerWidth: number,
  ): string {
    const star = isFav ? this.theme.fg("warning", "󰓎") + " " : "  ";
    const idText = isCurrent ? this.theme.fg("success", item.id) : item.id;
    const leftPart = star + idText;

    const ctxStr = formatContext(item.model.contextWindow).padStart(5);
    const ctxColor =
      item.model.contextWindow >= 500_000
        ? "success"
        : item.model.contextWindow >= 300_000
          ? "warning"
          : item.model.contextWindow >= 200_000
            ? "text"
            : "muted";
    const ctxColored = this.theme.fg(ctxColor, ctxStr);

    const brainSlot = item.model.reasoning ? `${PINK} ${RESET_FG}` : "  ";
    const imgSlot = item.model.input?.includes("image") ? this.theme.fg("success", "󰋩 ") : "  ";

    const prov = this.theme.fg("muted", `[${item.provider}]`);
    const rightPart = `${prov}  ${ctxColored}  ${brainSlot}${imgSlot}`;
    const gap = Math.max(1, innerWidth - visibleWidth(leftPart) - visibleWidth(rightPart));

    const fullLine = `${leftPart}${" ".repeat(gap)}${rightPart}`;
    return selected ? `\x1b[48;2;49;50;68m${fullLine}\x1b[49m` : fullLine;
  }

  private boxTop(w: number): string {
    return this.theme.fg("borderMuted", " ╭" + "─".repeat(w) + "╮");
  }

  private boxSep(w: number): string {
    return this.theme.fg("borderMuted", " ├" + "─".repeat(w) + "┤");
  }

  private boxBottom(w: number): string {
    return this.theme.fg("borderMuted", " ╰" + "─".repeat(w) + "╯");
  }

  private boxLine(content: string, innerWidth: number): string {
    const pad = Math.max(0, innerWidth - visibleWidth(content));
    return (
      this.theme.fg("borderMuted", " │") + content + " ".repeat(pad) + this.theme.fg("borderMuted", "│")
    );
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      this.onCancel();
      return;
    }

    const sel = this.filteredModels[this.selectedIndex];
    if (!sel && !matchesKey(data, "up") && !matchesKey(data, "down")) return;

    if (matchesKey(data, "ctrl+f")) {
      this.state.toggleFavorite(sel.provider, sel.id);
      this.refreshAfterStateChange(sel);
      return;
    }

    if (matchesKey(data, "ctrl+h")) {
      this.state.toggleProviderHidden(sel.provider);
      this.refreshAfterStateChange(sel);
      return;
    }

    if (matchesKey(data, "up")) {
      this.selectedIndex =
        this.selectedIndex === 0 ? this.filteredModels.length - 1 : this.selectedIndex - 1;
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "down")) {
      this.selectedIndex =
        this.selectedIndex === this.filteredModels.length - 1 ? 0 : this.selectedIndex + 1;
      this.tui.requestRender();
      return;
    }

    this.searchInput.handleInput(data);
    this.filterModels(this.searchInput.getValue());
  }

  invalidate(): void {
    this.searchInput.invalidate();
  }
}

// ─── Extension entrypoint ───────────────────────────────────────────────────

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
