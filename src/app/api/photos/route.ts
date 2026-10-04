import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface PhotoResponseItem {
  id: string;
  file: string;
  theme: string;
  src: string;
}

export async function GET() {
  try {
    const libraryDir = path.join(process.cwd(), "public", "library");

    if (!fs.existsSync(libraryDir)) {
      return NextResponse.json({ photos: [] });
    }

    const files = fs.readdirSync(libraryDir);
    const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

    const validFiles = files.filter((f) =>
      imageExtensions.has(path.extname(f).toLowerCase())
    );

    // Optional tags.json and photo_meta.json metadata
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
    const tagsPath = path.join(dataDir, "tags.json");
    let tags: Record<string, { setting?: string }> = {};
    if (fs.existsSync(tagsPath)) {
      try {
        tags = JSON.parse(fs.readFileSync(tagsPath, "utf-8"));
      } catch {
        // Continue with filename fallback
      }
    }

    const photoMetaPath = path.join(dataDir, "photo_meta.json");
    let photoMeta: Record<string, any> = {};
    if (fs.existsSync(photoMetaPath)) {
      try {
        photoMeta = JSON.parse(fs.readFileSync(photoMetaPath, "utf-8"));
      } catch {
        // Continue without photo_meta
      }
    }

    const photos: any[] = validFiles.map((file) => {
      const ext = path.extname(file);
      const id = path.basename(file, ext);
      
      // Theme from filename prefix "<theme>_<nn>" or tags
      const parts = id.split("_");
      const themeFromFilename = parts.length > 1 ? parts[0] : "general";
      const theme = tags[file]?.setting || themeFromFilename;
      const meta = photoMeta[file] || {};

      return {
        id,
        file,
        theme,
        src: `/library/${file}`,
        taken_at: meta.taken_at || null,
        year: meta.year || null,
        month_name: meta.month_name || null,
        event_title: meta.event_title || null,
        city: meta.place?.city || null,
        venue: meta.place?.venue || null,
        people: meta.people || [],
      };
    });

    // Chronological sort: newest first (standard Google Photos order)
    photos.sort((a, b) => {
      if (a.taken_at && b.taken_at) {
        return new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime();
      }
      if (a.taken_at) return -1;
      if (b.taken_at) return 1;
      return a.file.localeCompare(b.file);
    });

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Failed to load photo library:", error);
    return NextResponse.json(
      { error: "Library not available" },
      { status: 500 }
    );
  }
}
