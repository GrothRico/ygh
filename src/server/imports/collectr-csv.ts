import { Buffer } from "node:buffer";

export const COLLECTR_CSV_MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const MAX_CSV_RECORDS = 50_000;
const MAX_CSV_COLUMNS = 256;

export type CollectrCsvIssue = {
  line: number;
  code: "field-count" | "invalid-quantity" | "unknown-watchlist";
  message: string;
};

export type CollectrCsvRow = {
  line: number;
  /** Exact source spelling of this record, including quotes but excluding its line ending. */
  raw: string;
  /** Decoded fields in source order, including any fields beyond the header. */
  fields: string[];
  /** All source columns by their exact header, without trimming or interpretation. */
  values: Record<string, string>;
  watchlist: "true" | "false" | "unknown";
  issues: CollectrCsvIssue[];
};

export type CollectrCsvResult =
  | { ok: false; error: string }
  | { ok: true; headers: string[]; rows: CollectrCsvRow[]; issues: CollectrCsvIssue[]; diagnosticsTruncated: boolean };

type CsvRecord = { line: number; fields: string[]; raw: string };

function scanCsv(source: string): { records: CsvRecord[] } | { error: string } {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let line = 1;
  let recordLine = 1;
  let recordStart = 0;
  let state: "start" | "plain" | "quoted" | "after-quote" = "start";

  const endField = () => {
    if (fields.length >= MAX_CSV_COLUMNS) return false;
    fields.push(field);
    field = "";
    state = "start";
    return true;
  };
  const endRecord = (endOffset: number) => {
    if (records.length >= MAX_CSV_RECORDS) return false;
    if (!endField()) return false;
    records.push({ line: recordLine, fields, raw: source.slice(recordStart, endOffset) });
    fields = [];
    recordLine = line + 1;
    recordStart = endOffset + (source[endOffset] === "\r" && source[endOffset + 1] === "\n" ? 2 : 1);
    return true;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\r" || char === "\n") {
      const newlineLength = char === "\r" && source[index + 1] === "\n" ? 2 : 1;
      if (state === "quoted") {
        field += source.slice(index, index + newlineLength);
      } else {
        if (!endRecord(index)) return { error: "CSV überschreitet 50.000 Datensätze oder 256 Spalten." };
      }
      line += 1;
      if (newlineLength === 2) index += 1;
      continue;
    }

    if (state === "quoted") {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          state = "after-quote";
        }
      } else {
        field += char;
      }
      continue;
    }

    if (state === "after-quote") {
      if (char === ",") {
        if (!endField()) return { error: "CSV überschreitet 50.000 Datensätze oder 256 Spalten." };
      }
      else return { error: `Ungültige CSV-Syntax in Zeile ${line}.` };
      continue;
    }

    if (char === ",") {
      if (!endField()) return { error: "CSV überschreitet 50.000 Datensätze oder 256 Spalten." };
    } else if (char === '"') {
      if (state !== "start") return { error: `Quote innerhalb eines unquoted Feldes in Zeile ${line}.` };
      state = "quoted";
    } else {
      field += char;
      state = "plain";
    }
  }

  if (state === "quoted") return { error: `Nicht geschlossenes Quote ab Zeile ${recordLine}.` };
  if (fields.length > 0 || field.length > 0 || state !== "start") {
    if (!endRecord(source.length)) return { error: "CSV überschreitet 50.000 Datensätze oder 256 Spalten." };
  }
  return { records };
}

export function parseCollectrCsv(input: string | Uint8Array): CollectrCsvResult {
  let source: string;
  if (typeof input === "string") {
    if (Buffer.byteLength(input, "utf8") > COLLECTR_CSV_MAX_BYTES) {
      return { ok: false, error: "CSV überschreitet das Größenlimit von 10 MiB." };
    }
    source = input;
  } else {
    if (input.byteLength > COLLECTR_CSV_MAX_BYTES) {
      return { ok: false, error: "CSV überschreitet das Größenlimit von 10 MiB." };
    }
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(input);
    } catch {
      return { ok: false, error: "CSV ist kein gültiges UTF-8." };
    }
  }

  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  const scanned = scanCsv(source);
  if ("error" in scanned) return { ok: false, error: scanned.error };
  if (scanned.records.length === 0) return { ok: false, error: "CSV enthält keine Kopfzeile." };

  const headers = scanned.records[0].fields;
  if (headers.some((header) => header.length === 0)) return { ok: false, error: "CSV enthält einen leeren Header." };
  if (new Set(headers).size !== headers.length) return { ok: false, error: "CSV enthält doppelte Header." };
  for (const required of ["Portfolio Name", "Product Name", "Quantity", "Watchlist"]) {
    if (!headers.includes(required)) return { ok: false, error: `Erforderlicher Header fehlt: ${required}.` };
  }

  const quantityIndex = headers.indexOf("Quantity");
  const watchlistIndex = headers.indexOf("Watchlist");
  const rows: CollectrCsvRow[] = [];
  const issues: CollectrCsvIssue[] = [];
  let diagnosticsTruncated = false;
  for (const record of scanned.records.slice(1)) {
    if (record.raw.length === 0) continue;
    const rowIssues: CollectrCsvIssue[] = [];
    const addIssue = (issue: CollectrCsvIssue) => {
      rowIssues.push(issue);
      if (issues.length < MAX_DIAGNOSTICS) issues.push(issue);
      else diagnosticsTruncated = true;
    };
    if (record.fields.length !== headers.length) {
      addIssue({ line: record.line, code: "field-count", message: `Erwartet ${headers.length} Felder, erhalten ${record.fields.length}.` });
      const values = Object.fromEntries(headers.slice(0, record.fields.length).map((header, index) => [header, record.fields[index]]));
      rows.push({ line: record.line, raw: record.raw, fields: record.fields, values, watchlist: "unknown", issues: rowIssues });
      continue;
    }

    const values = Object.fromEntries(headers.map((header, index) => [header, record.fields[index]]));
    const rawWatchlist = record.fields[watchlistIndex];
    const watchlist = rawWatchlist === "true" ? "true" : rawWatchlist === "false" ? "false" : "unknown";
    if (watchlist === "unknown") {
      addIssue({ line: record.line, code: "unknown-watchlist", message: "Watchlist-Wert ist nicht exakt true oder false; Rohwert bleibt erhalten." });
    }
    const quantity = record.fields[quantityIndex];
    const quantityValue = /^[1-9]\d*$/.test(quantity) ? Number(quantity) : Number.NaN;
    const quantityIsValid = Number.isSafeInteger(quantityValue) && quantityValue > 0;
    if (!(watchlist === "true" && quantity === "") && !quantityIsValid) {
      addIssue({ line: record.line, code: "invalid-quantity", message: "Physische Menge muss eine positive Ganzzahl sein." });
    }
    rows.push({ line: record.line, raw: record.raw, fields: record.fields, values, watchlist, issues: rowIssues });
  }
  return { ok: true, headers, rows, issues, diagnosticsTruncated };
}
