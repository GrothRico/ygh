import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("Startseite", () => {
  it("rendert den deutschen Einstieg serverseitig", () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain("Deine Yu-Gi-Oh!-Sammlung");
    expect(markup).toContain("private Sammlungsverwaltung");
  });
});
