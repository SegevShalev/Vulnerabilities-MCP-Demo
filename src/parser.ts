import { readFileSync } from "fs";
import { HASHTAG_AT_START_WORD } from "./utils/regex.js";
export interface ParsedFile {
  version: string;
  columns: string[];
  recordType: string;
  records: Record<string, string>[];
}

/**
 * Parses pipe delimited db format
 * Reads the METADATA header to dynamically determine columns
 * maps each data row
 */
export function parseDbFile(filePath: string): ParsedFile {
  const content = readFileSync(filePath, "utf-8");
  // const lines = content.split("\n").filter((line) => line.trim() !== "");
  const lines = content
    .split("\n")
    .filter((line: string) => line.trim() !== "");

  let version = "unknown";
  let columns: string[] = [];

  const metadataLines = lines.filter((line) => line.startsWith("#"));
  const dataLines = lines.filter((line) => !line.startsWith("#"));

  for (const line of metadataLines) {
    const stripped = line.replace(HASHTAG_AT_START_WORD, ""); // # FORMAT: => FORMAT:

    if (stripped.startsWith("FORMAT:")) {
      const format = stripped.replace("FORMAT:", "").trim();
      columns = format.split("|").map((col) => col.trim());
    } else if (stripped.startsWith("VERSION:")) {
      version = stripped.replace("VERSION:", "").trim();
    }
  }

  if (columns.length === 0) {
    throw new Error(`No FORMAT metadata found in ${filePath}`);
  }

  const recordType = columns[0];
  const records: Record<string, string>[] = [];

  for (const line of dataLines) {
    const values = line.split("|");
    const record: Record<string, string> = {};
    for (let i = 0; i < columns.length; i++) {
      record[columns[i]] = values[i]?.trim() ?? "";
    }
    records.push(record);
  }

  return { version, columns, recordType, records };
}
