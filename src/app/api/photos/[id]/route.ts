import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/dataLoader";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const photo = dataStore.getPhotoById(id);
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  return NextResponse.json({ photo });
}
