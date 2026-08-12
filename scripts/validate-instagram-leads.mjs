import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const REQUIRED_COLUMNS = [
  "instagram_username",
  "profile_url",
  "account_type",
  "follower_count",
  "follower_count_display",
  "public_status",
  "aoyama_signal",
  "discovery_channel",
  "aoyama_evidence",
  "evidence_url",
  "confidence",
  "last_checked_at",
  "adult_service_eligibility",
  "dm_status",
];

const ALLOWED = {
  account_type: new Set(["individual", "circle_official", "student_media", "event", "other"]),
  public_status: new Set(["public", "private", "unknown"]),
  aoyama_signal: new Set(["profile_explicit", "hashtag_post", "hub_follower", "mention_or_tag", "ambiguous_context", "other"]),
  discovery_channel: new Set(["hashtag", "hub_followers", "circle_event", "keyword_search"]),
  confidence: new Set(["A", "B", "C"]),
  adult_service_eligibility: new Set(["eligible", "unknown", "not_eligible"]),
  dm_status: new Set(["not_checked", "candidate", "sent", "replied", "no_reply", "opted_out"]),
};

export function normalizeHandle(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }

  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  const records = rows.slice(1).map((values, rowIndex) => {
    const record = { __row: rowIndex + 2 };
    headers.forEach((header, index) => {
      record[header] = String(values[index] ?? "").trim();
    });
    return record;
  });
  return { headers, records };
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "www.instagram.com" || url.hostname === "instagram.com");
  } catch {
    return false;
  }
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateLeads({ headers, records }, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const headerSet = new Set(headers);

  for (const column of REQUIRED_COLUMNS) {
    if (!headerSet.has(column)) errors.push(`Missing required column: ${column}`);
  }

  const seenHandles = new Map();
  let dmReadyCount = 0;
  let publicCount = 0;
  let confidenceABCount = 0;
  let confidenceCCount = 0;

  records.forEach((record) => {
    const row = record.__row;
    const handle = normalizeHandle(record.instagram_username);
    if (!handle) {
      errors.push(`Row ${row}: instagram_username is required`);
    } else if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
      errors.push(`Row ${row}: invalid Instagram username: ${record.instagram_username}`);
    } else if (seenHandles.has(handle)) {
      errors.push(`Row ${row}: duplicate Instagram username ${handle} (row ${seenHandles.get(handle)})`);
    } else {
      seenHandles.set(handle, row);
    }

    if (record.profile_url && !isValidUrl(record.profile_url)) errors.push(`Row ${row}: profile_url must be an Instagram HTTPS URL`);
    if (record.evidence_url && !/^https:\/\//.test(record.evidence_url)) errors.push(`Row ${row}: evidence_url must be HTTPS`);
    if (record.follower_count && !/^\d+$/.test(record.follower_count)) errors.push(`Row ${row}: follower_count must be a non-negative integer`);

    for (const column of REQUIRED_COLUMNS) {
      if (!record[column]) errors.push(`Row ${row}: ${column} is required`);
    }
    for (const [column, allowed] of Object.entries(ALLOWED)) {
      if (record[column] && !allowed.has(record[column])) errors.push(`Row ${row}: invalid ${column}: ${record[column]}`);
    }
    if (record.last_checked_at && !isIsoDate(record.last_checked_at)) errors.push(`Row ${row}: last_checked_at must be YYYY-MM-DD`);
    if (record.confidence === "C" && !record.notes) errors.push(`Row ${row}: notes is required for C-confidence accounts`);
    if (record.discovery_channel === "hub_followers" && !record.source_account) errors.push(`Row ${row}: source_account is required for hub_followers`);

    if (record.public_status === "public") publicCount += 1;
    if (record.confidence === "A" || record.confidence === "B") confidenceABCount += 1;
    if (record.confidence === "C") confidenceCCount += 1;
    if (record.confidence === "C" && record.dm_status === "candidate") warnings.push(`Row ${row}: C-confidence account is marked as a DM candidate`);
    if (record.public_status !== "public" && record.dm_status === "candidate") warnings.push(`Row ${row}: non-public/unknown account is marked as a DM candidate`);
    if (record.adult_service_eligibility !== "eligible" && record.dm_status === "candidate") warnings.push(`Row ${row}: adult eligibility is not confirmed for DM candidate`);

    if (record.public_status === "public" && (record.confidence === "A" || record.confidence === "B") && record.adult_service_eligibility === "eligible" && record.dm_status === "candidate") {
      dmReadyCount += 1;
    }
  });

  if (strict) {
    if (records.length !== 1000) errors.push(`Strict: expected exactly 1000 unique rows, found ${records.length}`);
    if (publicCount !== records.length) errors.push(`Strict: all rows must be public, found ${records.length - publicCount} non-public/unknown rows`);
    if (confidenceABCount < 800) errors.push(`Strict: expected at least 800 A/B rows, found ${confidenceABCount}`);
    if (confidenceCCount > 200) errors.push(`Strict: expected at most 200 C rows, found ${confidenceCCount}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      rows: records.length,
      public: publicCount,
      confidenceAB: confidenceABCount,
      confidenceC: confidenceCCount,
      dmReady: dmReadyCount,
    },
  };
}

function printResult(result, filePath, strict) {
  console.log(`Validated ${filePath}${strict ? " (strict)" : ""}`);
  console.log(JSON.stringify(result.summary, null, 2));
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const csvArgumentIndex = args.findIndex((argument) => argument === "--csv");
  const filePath = csvArgumentIndex >= 0 ? args[csvArgumentIndex + 1] : "sales/instagram-leads.csv";
  const absolutePath = path.resolve(filePath);
  const parsed = parseCsv(fs.readFileSync(absolutePath, "utf8"));
  printResult(validateLeads(parsed, { strict }), filePath, strict);
}
