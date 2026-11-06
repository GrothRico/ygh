import { describe, expect, it } from "vitest";
import { choiceLabel } from "./form-utils";
import type { StockChoice } from "../../server/stock";

const choice: StockChoice = {
  kind: "variant", id: "variant-limited", variantId: "variant-limited", language: null,
  edition: "limited", code: "SYN-L", setName: "Synthetic Set", rarity: "Common", artworkKey: "default",
};

describe("Beschriftungen bestätigter Varianten", () => {
  it("zeigt Limited Edition getrennt von Seltenheit und Artwork", () => {
    expect(choiceLabel(choice)).toBe("SYN-L · Synthetic Set · Common · Limited Edition");
  });

  it("trennt unbekannte Edition mit null Edition sauber ab", () => {
    expect(choiceLabel({ ...choice, edition: null })).toBe("SYN-L · Synthetic Set · Common · Edition unbekannt");
  });
});
