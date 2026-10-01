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

    // Optional tags.json metadata
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

    const photos: PhotoResponseItem[] = validFiles.map((file) => {
      const ext = path.extname(file);
      const id = path.basename(file, ext);
      
      // Theme from filename prefix "<theme>_<nn>" or tags
      const parts = id.split("_");
      const themeFromFilename = parts.length > 1 ? parts[0] : "general";
      const theme = tags[file]?.setting || themeFromFilename;

      return {
        id,
        file,
        theme,
        src: `/library/${file}`,
      };
    });

    // Deterministic sort: by theme then filename
    photos.sort((a, b) => {
      if (a.theme !== b.theme) {
        return a.theme.localeCompare(b.theme);
      }
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
