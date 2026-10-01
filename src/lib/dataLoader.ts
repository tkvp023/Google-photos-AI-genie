// src/lib/dataLoader.ts — In-Memory Data Store & Loader
import fs from "fs";
import path from "path";
import { CueType, PhotoItem, PhotoTag, StudyTarget, Tags } from "@/types";

export interface PlacesData {
  namedPlaces: string[];
  people: string[];
}

export type CueLexiconData = Record<CueType, string[]>;

class DataStore {
  private photos: PhotoItem[] = [];
  private tags: Tags = {};
  private synonyms: Record<string, string> = {};
  private places: PlacesData = { namedPlaces: [], people: [] };
  private cueLexicon: Partial<CueLexiconData> = {};
  private targets: StudyTarget[] = [];
  private initialized = false;

  constructor() {
    this.init();
  }

  public init(): void {
    const cwd = process.cwd();
    const dataDir = path.join(cwd, "data");
    const libraryDir = path.join(cwd, "public", "library");

    // 1. Load tags.json (fall back to tags_sample.json if needed)
    this.tags = {};
    const tagsPath = path.join(dataDir, "tags.json");
    const samplePath = path.join(dataDir, "tags_sample.json");

    if (fs.existsSync(tagsPath)) {
      try {
        const raw = fs.readFileSync(tagsPath, "utf-8");
        this.tags = JSON.parse(raw);
      } catch (err) {
        console.warn("[DataLoader] Failed to parse data/tags.json:", err);
      }
    }

    if (Object.keys(this.tags).length === 0 && fs.existsSync(samplePath)) {
      try {
        const raw = fs.readFileSync(samplePath, "utf-8");
        this.tags = JSON.parse(raw);
      } catch (err) {
        console.warn("[DataLoader] Failed to parse data/tags_sample.json:", err);
      }
    }

    // 2. Load synonyms.json
    this.synonyms = {};
    const synPath = path.join(dataDir, "synonyms.json");
    if (fs.existsSync(synPath)) {
      try {
        this.synonyms = JSON.parse(fs.readFileSync(synPath, "utf-8"));
      } catch (err) {
        console.warn("[DataLoader] Failed to parse synonyms.json:", err);
      }
    }

    // 3. Load places.json
    this.places = { namedPlaces: [], people: [] };
    const placesPath = path.join(dataDir, "places.json");
    if (fs.existsSync(placesPath)) {
      try {
        this.places = JSON.parse(fs.readFileSync(placesPath, "utf-8"));
      } catch (err) {
        console.warn("[DataLoader] Failed to parse places.json:", err);
      }
    }

    // 4. Load cue_lexicon.json
    this.cueLexicon = {};
    const cuePath = path.join(dataDir, "cue_lexicon.json");
    if (fs.existsSync(cuePath)) {
      try {
        this.cueLexicon = JSON.parse(fs.readFileSync(cuePath, "utf-8"));
      } catch (err) {
        console.warn("[DataLoader] Failed to parse cue_lexicon.json:", err);
      }
    }

    // 5. Load targets.json
    this.targets = [];
    const targetsPath = path.join(dataDir, "targets.json");
    if (fs.existsSync(targetsPath)) {
      try {
        this.targets = JSON.parse(fs.readFileSync(targetsPath, "utf-8"));
      } catch (err) {
        console.warn("[DataLoader] Failed to parse targets.json:", err);
      }
    }

    // 6. Build PhotoItem[] from library directory
    this.photos = [];
    if (fs.existsSync(libraryDir)) {
      const files = fs.readdirSync(libraryDir);
      const validFiles = files
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .sort((a, b) => {
          const themeA = a.split("_")[0];
          const themeB = b.split("_")[0];
          if (themeA !== themeB) return themeA.localeCompare(themeB);
          return a.localeCompare(b);
        });

      for (const file of validFiles) {
        const id = file.replace(/\.[^.]+$/, "");
        const theme = file.split("_")[0] || "general";
        const tag = this.tags[file] || this.createDefaultTag(theme, file);

        this.photos.push({
          id,
          file,
          theme,
          src: `/library/${file}`,
          tag,
        });
      }
    }

    this.initialized = true;
  }

  private createDefaultTag(theme: string, file: string): PhotoTag {
    return {
      one_line: `${theme} photo featuring people`,
      setting: theme,
      indoor_outdoor: "outdoor",
      activity: theme === "pool" ? "swimming" : theme === "beach" ? "playing" : "socializing",
      occasion_guess: theme === "birthday" ? "birthday" : theme === "graduation" ? "graduation" : "none",
      occasion_basis: "theme",
      people_count: 2,
      people_ages: ["adult"],
      people_bucket: "2",
      group_type: "friends",
      clothing: [],
      objects: [theme],
      time_of_day: "afternoon",
      weather_or_season: "sunny",
      mood: "cheerful",
      text_in_image: "none",
    };
  }

  public reload(): void {
    this.init();
  }

  public getPhotos(): PhotoItem[] {
    if (!this.initialized) this.init();
    return this.photos;
  }

  public getPhotoById(id: string): PhotoItem | undefined {
    if (!this.initialized) this.init();
    const cleanId = id.replace(/\.[^.]+$/, "");
    return this.photos.find((p) => p.id === cleanId || p.file === id);
  }

  public getTags(): Tags {
    if (!this.initialized) this.init();
    return this.tags;
  }

  public getSynonyms(): Record<string, string> {
    if (!this.initialized) this.init();
    return this.synonyms;
  }

  public getPlaces(): PlacesData {
    if (!this.initialized) this.init();
    return this.places;
  }

  public getCueLexicon(): Partial<CueLexiconData> {
    if (!this.initialized) this.init();
    return this.cueLexicon;
  }

  public getTargets(): StudyTarget[] {
    if (!this.initialized) this.init();
    return this.targets;
  }
}

// Global singleton instance
export const dataStore = new DataStore();
