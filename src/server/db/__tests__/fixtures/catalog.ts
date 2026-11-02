// Every value in this fixture is invented for tests; it is not an imported card.
export const syntheticCatalog = {
  card: {
    id: "fixture-card-001",
    nameDe: "Beispiel Drache",
    nameEn: "Example Dragon",
    effectDe: "Synthetischer Effekttext.",
    effectEn: "Synthetic effect text.",
  },
  set: {
    id: "fixture-set-001",
    name: "Beispielset",
    code: "SYN-01",
    catalogStatus: "partial",
  },
  variant: {
    id: "fixture-variant-001",
    cardId: "fixture-card-001",
    setId: "fixture-set-001",
    collectorNumber: "SYN-01-001",
    edition: "first",
    rarity: "synthetic-ultra",
    artworkKey: "fixture-artwork-a",
  },
  printings: [
    {
      id: "fixture-printing-de",
      variantId: "fixture-variant-001",
      language: "de",
      printedCode: "SYN-01-DE-001",
      source: "synthetic-fixture",
      sourceId: "fixture-source-print-de",
    },
    {
      id: "fixture-printing-en",
      variantId: "fixture-variant-001",
      language: "en",
      printedCode: "SYN-01-EN-001",
      source: "synthetic-fixture",
      sourceId: "fixture-source-print-en",
    },
  ],
} as const;
