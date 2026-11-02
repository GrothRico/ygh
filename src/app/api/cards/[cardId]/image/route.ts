import { eq } from "drizzle-orm";
import { withFileAccess } from "../../../../../server/access";
import { openDatabase } from "../../../../../server/db";
import { cards } from "../../../../../server/db/schema";
import { cardImageCacheDirectory, readCachedCardImage } from "../../../../../server/catalog/image-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ cardId: string }> },
) {
  return withFileAccess(async () => {
    const { cardId } = await context.params;
    const databasePath = process.env.DATABASE_PATH;
    if (!databasePath) return new Response(null, { status: 404 });

    let sourceId: string | null = null;
    try {
      const connection = openDatabase(databasePath);
      try {
        const card = connection.db.select({ source: cards.source, sourceId: cards.sourceId })
          .from(cards).where(eq(cards.id, cardId)).get();
        sourceId = card?.source === "ygoprodeck" && card.sourceId && /^\d+$/.test(card.sourceId)
          ? card.sourceId
          : null;
      } finally {
        connection.close();
      }
    } catch {
      return new Response(null, { status: 404 });
    }
    if (!sourceId) return new Response(null, { status: 404 });

    const image = await readCachedCardImage(cardImageCacheDirectory(databasePath), sourceId);
    if (!image) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(image), {
      status: 200,
      headers: { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff" },
    });
  });
}
