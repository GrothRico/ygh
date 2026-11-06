import { describe, expect, it } from "vitest";
import { COLLECTR_CSV_MAX_BYTES, parseCollectrCsv } from "./collectr-csv";

const headers = [
  "Portfolio Name", "Category", "Set", "Product Name", "Card Number", "Rarity", "Variance",
  "Grade", "Card Condition", "Average Cost Paid", "Quantity", "Market Price (As of 2026-11-03)",
  "Price Override", "Watchlist", "Date Added", "Notes",
];

function csvRow(overrides: Record<string, string> = {}) {
  return headers.map((header) => overrides[header] ?? "").join(",");
}

describe("parseCollectrCsv", () => {
  it("reads reordered and additional columns while preserving raw values and multiline row start", () => {
    const source = [
      "Notes,Watchlist,Quantity,Portfolio Name,Product Name,Variance,Market Price (As of 2026-11-03),Extra",
      '"Notiz, mit ""Zitat""\r\nzweite Zeile",false,2,Sammlung,"Dunkler Magier",Limited,1.25,x',
    ].join("\r\n");
    const result = parseCollectrCsv(`\uFEFF${source}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({
      line: 2,
      raw: '"Notiz, mit ""Zitat""\r\nzweite Zeile",false,2,Sammlung,"Dunkler Magier",Limited,1.25,x',
      watchlist: "false",
      values: {
        Notes: 'Notiz, mit "Zitat"\r\nzweite Zeile',
        "Product Name": "Dunkler Magier",
        Variance: "Limited",
        "Market Price (As of 2026-11-03)": "1.25",
        Extra: "x",
      },
      issues: [],
    });
  });

  it("retains edition and language evidence as raw text without deriving language", () => {
    const source = `${headers.join(",")}\n${csvRow({
      "Portfolio Name": "Sammlung", "Product Name": "Blue-Eyes White Dragon", Quantity: "1", Watchlist: "false", Variance: "Normal",
    })}`;
    const result = parseCollectrCsv(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].values.Variance).toBe("Normal");
    expect(result.rows[0].values["Product Name"]).toBe("Blue-Eyes White Dragon");
    expect(result.rows[0].values).not.toHaveProperty("Language");
  });

  it("preserves blank and unknown edition values and keeps identical source rows separate", () => {
    const first = csvRow({ "Portfolio Name": "A", "Product Name": "x", Quantity: "1", Watchlist: "false", Variance: "" });
    const second = csvRow({ "Portfolio Name": "A", "Product Name": "x", Quantity: "1", Watchlist: "false", Variance: "Special unknown" });
    const result = parseCollectrCsv(`${headers.join(",")}\n${first}\n${first}\n${second}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((row) => row.values.Variance)).toEqual(["", "", "Special unknown"]);
  });

  it("allows watchlist true with empty quantity and portfolio, but rejects empty physical quantity", () => {
    const source = `${headers.join(",")}\n${csvRow({ "Product Name": "Watchlist only", Watchlist: "true" })}\n${csvRow({ "Portfolio Name": "A", "Product Name": "Missing quantity", Watchlist: "false" })}`;
    const result = parseCollectrCsv(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].issues).toEqual([]);
    expect(result.rows[0].values["Portfolio Name"]).toBe("");
    expect(result.rows[1].issues.map((issue) => issue.code)).toEqual(["invalid-quantity"]);
  });

  it("validates filled watchlist quantities and rejects unsafe integers", () => {
    const source = `${headers.join(",")}\n${csvRow({ "Product Name": "Watchlist", Quantity: "many", Watchlist: "true" })}\n${csvRow({ "Portfolio Name": "A", "Product Name": "Large", Quantity: "9007199254740992", Watchlist: "false" })}`;
    const result = parseCollectrCsv(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((row) => row.issues.map((issue) => issue.code))).toEqual([["invalid-quantity"], ["invalid-quantity"]]);
  });

  it("reports unknown watchlist values and invalid physical quantities without changing raw values", () => {
    const source = `${headers.join(",")}\n${csvRow({ "Portfolio Name": "A", "Product Name": "x", Quantity: "0", Watchlist: "TRUE" })}`;
    const result = parseCollectrCsv(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].watchlist).toBe("unknown");
    expect(result.rows[0].values.Watchlist).toBe("TRUE");
    expect(result.rows[0].issues.map((issue) => issue.code)).toEqual(["unknown-watchlist", "invalid-quantity"]);
  });

  it("rejects duplicate headers and malformed quoting rather than overwriting or dropping data", () => {
    expect(parseCollectrCsv("Portfolio Name,Product Name,Quantity,Watchlist,Watchlist").ok).toBe(false);
    const malformed = `Portfolio Name,Product Name,Quantity,Watchlist\nA,"unfinished,1,false`;
    expect(parseCollectrCsv(malformed)).toMatchObject({ ok: false, error: expect.stringContaining("Nicht geschlossenes Quote") });
    expect(parseCollectrCsv('Portfolio Name,Product Name,Quantity,Watchlist\nA,"name" ,1,false')).toMatchObject({ ok: false, error: expect.stringContaining("CSV-Syntax") });
  });

  it("retains physical source line numbers and reports field-width errors", () => {
    const source = `Portfolio Name,Product Name,Quantity,Watchlist\nA,"mehrzeilig\nName",1,false\nshort`;
    const result = parseCollectrCsv(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].line).toBe(2);
    expect(result.rows[1].raw).toBe("short");
    expect(result.rows[1].fields).toEqual(["short"]);
    expect(result.rows[1].values).toEqual({ "Portfolio Name": "short" });
    expect(result.issues).toEqual([{ line: 4, code: "field-count", message: "Erwartet 4 Felder, erhalten 1." }]);
  });

  it("enforces the byte limit before CSV scanning and rejects invalid UTF-8 bytes", () => {
    expect(parseCollectrCsv(new Uint8Array(COLLECTR_CSV_MAX_BYTES + 1))).toMatchObject({ ok: false, error: expect.stringContaining("Größenlimit") });
    expect(parseCollectrCsv(new Uint8Array([0xff]))).toMatchObject({ ok: false, error: expect.stringContaining("UTF-8") });
  });

  it("enforces fixed record and column caps", () => {
    const recordOverflow = `Portfolio Name,Product Name,Quantity,Watchlist\n${Array.from({ length: 50_000 }, () => "A,x,1,false").join("\n")}`;
    expect(parseCollectrCsv(recordOverflow)).toMatchObject({ ok: false, error: expect.stringContaining("50.000 Datensätze") });
    const columnOverflow = `${Array.from({ length: 257 }, (_, index) => `h${index}`).join(",")}`;
    expect(parseCollectrCsv(columnOverflow)).toMatchObject({ ok: false, error: expect.stringContaining("256 Spalten") });
  });

  it("caps diagnostics for adversarially many malformed rows", () => {
    const badRows = Array.from({ length: 150 }, () => "too,few").join("\n");
    const result = parseCollectrCsv(`Portfolio Name,Product Name,Quantity,Watchlist\n${badRows}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.issues).toHaveLength(100);
    expect(result.diagnosticsTruncated).toBe(true);
    expect(result.rows[149].issues).toHaveLength(1);
  });

  it("retains an explicitly quoted empty record as a malformed row", () => {
    const result = parseCollectrCsv(`Portfolio Name,Product Name,Quantity,Watchlist\n\"\"`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ raw: '\"\"', fields: [""] });
    expect(result.rows[0].issues[0].code).toBe("field-count");
  });
});
