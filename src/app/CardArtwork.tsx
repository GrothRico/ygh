"use client";

import { useState } from "react";
import Image from "next/image";

export function CardArtwork({ cardId, label }: { cardId: string | null; label: string }) {
  const [unavailable, setUnavailable] = useState(cardId === null);
  return (
    <div className="card-artwork">
      {!unavailable && cardId && (
        <Image src={`/api/cards/${encodeURIComponent(cardId)}/image`} alt={label} width={380} height={533} unoptimized loading="lazy" onError={() => setUnavailable(true)} />
      )}
      {unavailable && <span aria-label={`Kein Bild verfügbar für ${label}`}>Bild nicht verfügbar</span>}
    </div>
  );
}
