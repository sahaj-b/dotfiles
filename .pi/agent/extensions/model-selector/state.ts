import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const STATE_FILE = path.join(os.homedir(), ".pi", "model-selector.json");

export interface SelectorStateData {
  favorites: string[]; // "provider/id" strings
  hiddenProviders: string[]; // provider ids
  recentSelections: Record<string, number>; // "provider/id" -> timestamp
}

export class SelectorState {
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
          recentSelections: parsed.recentSelections && typeof parsed.recentSelections === "object" ? parsed.recentSelections : {},
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
