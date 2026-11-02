import "server-only";

import { asc, eq } from "drizzle-orm";
import { openDatabase } from "../db";
import { cards, printings, sets, sourcePrintingObservations, variants } from "../db/schema";

const MAX_QUERY_LENGTH = 100;
export const MAX_SEARCH_RESULTS = 30;
const MAX_DISTANCE = 2;

export type SearchPrinting = {
  kind: "confirmed" | "unconfirmed";
  variantId?: string;
  artworkKey?: string;
  setName: string;
  code: string;
  language?: string;
  edition?: string;
  rarity: string;
};

export type CardSearchResult = {
  id: string;
  nameDe: string | null;
  nameEn: string | null;
  sourceId: string | null;
  rank: number;
  printings: SearchPrinting[];
  morePrintings: number;
};

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de").trim();
}

function editDistance(left: string, right: string): number {
  if (Math.abs(left.length - right.length) > MAX_DISTANCE) return MAX_DISTANCE + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let minimum = row;
    for (let column = 1; column <= right.length; column += 1) {
      const value = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      current.push(value);
      minimum = Math.min(minimum, value);
    }
    if (minimum > MAX_DISTANCE) return MAX_DISTANCE + 1;
    previous = current;
  }
  return previous[right.length];
}

function fuzzyNameMatch(query: string, name: string): number | null {
  if (query.length < 4) return null;
  const normalizedName = normalize(name);
  const candidates = [normalizedName];
  if (!query.includes(" ")) candidates.push(...normalizedName.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4));
  const distances = candidates.map((candidate) => editDistance(query, candidate));
  const best = Math.min(...distances);
  return best <= MAX_DISTANCE ? best : null;
}

function matchRank(query: string, card: { nameDe: string | null; nameEn: string | null }, codes: string[]): number | null {
  const normalizedQuery = normalize(query);
  const normalizedCode = normalizedQuery.replace(/\s+/g, "");
  const codeMatches = codes.map(normalize).map((code) => code.replace(/\s+/g, ""));
  if (codeMatches.some((code) => code === normalizedCode)) return 0;
  if (codeMatches.some((code) => code.startsWith(normalizedCode))) return 1;
  if (codeMatches.some((code) => code.includes(normalizedCode))) return 2;
  if (normalizedCode.length >= 5 && codeMatches.some((code) => editDistance(normalizedCode, code) <= 2)) return 3;

  const names = [card.nameDe, card.nameEn].filter((name): name is string => name !== null).map(normalize);
  if (names.some((name) => name === normalizedQuery)) return 10;
  if (names.some((name) => name.includes(normalizedQuery))) return 11;
  const distances = names.map((name) => fuzzyNameMatch(normalizedQuery, name)).filter((distance): distance is number => distance !== null);
  return distances.length > 0 ? 20 + Math.min(...distances) : null;
}

function printedCodeRank(query: string, code: string): number {
  const normalizedQuery = normalize(query).replace(/\s+/g, "");
  const normalizedCode = normalize(code).replace(/\s+/g, "");
  if (normalizedCode === normalizedQuery) return 0;
  if (normalizedCode.startsWith(normalizedQuery)) return 1;
  if (normalizedCode.includes(normalizedQuery)) return 2;
  if (normalizedQuery.length >= 5 && editDistance(normalizedQuery, normalizedCode) <= MAX_DISTANCE) return 3;
  return 4;
}

export function searchCards(databasePath: string, rawQuery: string, limit = MAX_SEARCH_RESULTS): CardSearchResult[] {
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) return [];
  const connection = openDatabase(databasePath);
  try {
    const cardRows = connection.db.select({
      id: cards.id,
      nameDe: cards.nameDe,
      nameEn: cards.nameEn,
      source: cards.source,
      sourceId: cards.sourceId,
    }).from(cards).orderBy(asc(cards.id)).all();

    const confirmedRows = connection.db.select({
      cardId: variants.cardId,
      variantId: variants.id,
      setName: sets.name,
      code: printings.printedCode,
      language: printings.language,
      edition: variants.edition,
      rarity: variants.rarity,
      artworkKey: variants.artworkKey,
    }).from(printings)
      .innerJoin(variants, eq(printings.variantId, variants.id))
      .innerJoin(sets, eq(variants.setId, sets.id)).all();
    const observationRows = connection.db.select({
      cardId: sourcePrintingObservations.cardId,
      setName: sourcePrintingObservations.setName,
      code: sourcePrintingObservations.printedCode,
      rarity: sourcePrintingObservations.rarity,
    }).from(sourcePrintingObservations).all();
    const confirmedByCard = new Map<string, typeof confirmedRows>();
    const observationsByCard = new Map<string, typeof observationRows>();
    for (const row of confirmedRows) {
      const group = confirmedByCard.get(row.cardId) ?? [];
      group.push(row);
      confirmedByCard.set(row.cardId, group);
    }
    for (const row of observationRows) {
      const group = observationsByCard.get(row.cardId) ?? [];
      group.push(row);
      observationsByCard.set(row.cardId, group);
    }

    const results: CardSearchResult[] = [];
    for (const card of cardRows) {
      const confirmed = confirmedByCard.get(card.id) ?? [];
      const unconfirmed = observationsByCard.get(card.id) ?? [];
      const codes = [...confirmed.map((row) => row.code), ...unconfirmed.map((row) => row.code)];
      const rank = matchRank(query, card, codes);
      if (rank === null) continue;
      const allPrintings: SearchPrinting[] = [
        ...confirmed.map((row) => ({ ...row, kind: "confirmed" as const })),
        ...unconfirmed.map((row) => ({ ...row, kind: "unconfirmed" as const })),
      ];
      const displayPrintings = [...allPrintings].sort((left, right) =>
        printedCodeRank(query, left.code) - printedCodeRank(query, right.code) ||
        (left.kind === right.kind ? 0 : left.kind === "confirmed" ? -1 : 1) ||
        left.code.localeCompare(right.code));
      const maximumPrintingDetails = 8;
      results.push({
        id: card.id,
        nameDe: card.nameDe,
        nameEn: card.nameEn,
        sourceId: card.source === "ygoprodeck" && card.sourceId && /^\d+$/.test(card.sourceId) ? card.sourceId : null,
        rank,
        printings: displayPrintings.slice(0, maximumPrintingDetails),
        morePrintings: Math.max(0, displayPrintings.length - maximumPrintingDetails),
      });
    }
    return results.sort((left, right) => left.rank - right.rank ||
      normalize(left.nameDe ?? left.nameEn ?? "").localeCompare(normalize(right.nameDe ?? right.nameEn ?? "")) ||
      left.id.localeCompare(right.id)).slice(0, Math.max(1, Math.min(limit, MAX_SEARCH_RESULTS)));
  } finally {
    connection.close();
  }
}
