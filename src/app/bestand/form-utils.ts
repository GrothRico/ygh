import type { LocationRow } from "../../server/locations";
import type { StockChoice } from "../../server/stock";

const editionLabels = { unknown: "Unbekannt", first: "1st Edition", unlimited: "Unlimited", not_applicable: "Nicht anwendbar" } as const;

export function choiceLabel(choice: StockChoice): string {
  const edition = choice.edition ? editionLabels[choice.edition as keyof typeof editionLabels] ?? choice.edition : "Edition unbekannt";
  const language = choice.language ? ` · ${choice.language === "de" ? "Deutsch" : choice.language === "en" ? "Englisch" : choice.language}` : "";
  const source = choice.kind === "observation" ? " · nicht bestätigt" : "";
  return `${choice.code ? `${choice.code} · ` : ""}${choice.setName ?? "Variante"}${choice.rarity ? ` · ${choice.rarity}` : ""}${choice.artworkKey && choice.artworkKey !== "default" ? ` · Artwork ${choice.artworkKey}` : ""}${edition}${language}${source}`;
}

export function locationPath(location: LocationRow, all: LocationRow[]): string {
  const names = [location.name];
  let parentId = location.parentId;
  while (parentId) {
    const parent = all.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(" → ");
}
