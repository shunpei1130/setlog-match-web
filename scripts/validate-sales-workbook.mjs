import fs from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

export const MASTER_WORKBOOK = fileURLToPath(new URL("../outputs/01a16415-551a-7d00-aa9e-5d433832d204/営業リスト.xlsx", import.meta.url));
export const SALES_HEADERS = ["優先", "アカウント名", "Instagram", "区分", "フォロワー数", "URL確認", "確認日", "営業判定", "根拠・次の対応", "紹介URL", "進捗", "最終連絡日"];

// Read the standard ZIP container using Node built-ins; no Excel runtime or added dependency.
export function readXlsxEntries(buffer) {
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new Error("Not a valid XLSX ZIP container");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (count === 65535 || offset === 0xffffffff) throw new Error("ZIP64 is not supported by this small-workbook validator");
  const entries = new Map();
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP directory");
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (flags & 1) throw new Error("Encrypted workbooks are not supported");
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Invalid ZIP entry");
    const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    if (start + size > buffer.length || entries.has(name)) throw new Error("Invalid or duplicate ZIP entry");
    const bytes = buffer.subarray(start, start + size);
    const data = method === 0 ? bytes : method === 8 ? inflateRawSync(bytes) : null;
    if (!data) throw new Error(`Unsupported ZIP compression: ${method}`);
    entries.set(name, data.toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const decodeXml = text => String(text ?? "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
  if (entity[0] === "#") return String.fromCodePoint(entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
  return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[entity];
});
const attributes = text => Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(([, key, value]) => [key, decodeXml(value)]));
const textRuns = xml => [...String(xml ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(match => decodeXml(match[1])).join("");
const linkFormula = formula => {
  const match = String(formula ?? "").match(/^=?\s*(?:_xlfn\.)?HYPERLINK\("((?:[^"]|"")*)"\s*[,;]\s*"((?:[^"]|"")*)"\)$/i);
  return match ? { url: match[1].replaceAll('""', '"'), label: match[2].replaceAll('""', '"') } : null;
};

export function readSalesWorkbook(file = MASTER_WORKBOOK) {
  const entries = new Map([...readXlsxEntries(fs.readFileSync(file))].map(([name, xml]) => [name, xml.replace(/(<\/?)[A-Za-z_][\w.-]*:/g, "$1")]));
  const workbookXml = entries.get("xl/workbook.xml") ?? "";
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/g)].map(match => attributes(match[1]));
  if (sheets.length !== 1 || sheets[0].name !== "営業リスト") throw new Error("Expected exactly one sheet named 営業リスト");
  const workbookRelations = [...(entries.get("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].map(match => attributes(match[1]));
  const target = workbookRelations.find(item => item.Id === sheets[0]["r:id"])?.Target;
  if (!target) throw new Error("Worksheet relationship is missing");
  const sheetPath = target.startsWith("/") ? target.slice(1) : path.posix.normalize(`xl/${target}`);
  const sheetXml = entries.get(sheetPath);
  if (!sheetXml) throw new Error("Worksheet data is missing");
  const strings = [...(entries.get("xl/sharedStrings.xml") ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => textRuns(match[1]));
  const cellMap = new Map();
  for (const match of sheetXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attr = attributes(match[1]);
    const body = match[2] ?? "";
    const raw = decodeXml(body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]);
    const formula = decodeXml(body.match(/<f\b[^>]*>([\s\S]*?)<\/f>/)?.[1]);
    const link = linkFormula(formula);
    const value = link ? link.label : attr.t === "s" ? strings[Number(raw)] : attr.t === "inlineStr" ? textRuns(body) : raw === "" ? "" : attr.t === "str" || attr.t === "d" ? raw : Number(raw);
    cellMap.set(attr.r, { value, formula, link });
  }
  const relPath = path.posix.join(path.posix.dirname(sheetPath), "_rels", `${path.posix.basename(sheetPath)}.rels`);
  const relationships = new Map([...(entries.get(relPath) ?? "").matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].map(match => { const attr = attributes(match[1]); return [attr.Id, attr.Target]; }));
  for (const match of sheetXml.matchAll(/<hyperlink\b([^>]*)\/?\s*>/g)) {
    const attr = attributes(match[1]);
    const cell = cellMap.get(attr.ref);
    if (cell && !cell.link) cell.link = { url: relationships.get(attr["r:id"]) ?? "", label: cell.value };
  }
  const valueAt = (row, column) => cellMap.get(`${String.fromCharCode(65 + column)}${row}`)?.value ?? "";
  const headers = SALES_HEADERS.map((_, column) => valueAt(7, column));
  const dataRows = [...new Set([...cellMap.keys()].map(address => Number(address.match(/\d+$/)?.[0])).filter(row => row >= 8))].sort((a, b) => a - b);
  const rows = dataRows.filter(row => valueAt(row, 1) !== "" || valueAt(row, 2) !== "").map(row => ({
    row, priority: valueAt(row, 0), name: valueAt(row, 1), handle: valueAt(row, 2), type: valueAt(row, 3),
    followers: valueAt(row, 4), urlState: valueAt(row, 5), checked: valueAt(row, 6), decision: valueAt(row, 7),
    reason: valueAt(row, 8), referralLabel: valueAt(row, 9), progress: valueAt(row, 10), contacted: valueAt(row, 11),
    profileUrl: cellMap.get(`C${row}`)?.link?.url ?? "", contactUrl: cellMap.get(`I${row}`)?.link?.url ?? "", referralUrl: cellMap.get(`J${row}`)?.link?.url ?? "",
  }));
  return { headers, rows, sheets: sheets.length, tableCount: [...entries.keys()].filter(name => /^xl\/tables\/table\d+\.xml$/.test(name)).length, noteCount: [...entries.keys()].filter(name => /comments\d*\.xml$/.test(name)).reduce((sum, name) => sum + [...entries.get(name).matchAll(/<comment\b/g)].length, 0) };
}

function isoDate(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value.slice(0, 10) ? value.slice(0, 10) : null;
}

export function validateSalesRows({ headers, rows }, { strict = false, asOf = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }) } = {}) {
  const errors = [], warnings = [], handles = new Set(), urls = new Set(), priorities = new Set(), refs = new Set();
  if (JSON.stringify(headers) !== JSON.stringify(SALES_HEADERS)) errors.push("Expected the 12 master columns in their documented order");
  if (!rows.length) errors.push("The master list has no accounts");
  let verified = 0, unverified = 0, invalid = 0, excluded = 0, sendReady = 0, pending = 0;
  for (const record of rows) {
    const at = `Row ${record.row}`;
    const handle = String(record.handle).replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(handle)) errors.push(`${at}: invalid handle`);
    if (handles.has(handle)) errors.push(`${at}: duplicate handle ${handle}`);
    handles.add(handle);
    try {
      const url = new URL(record.profileUrl);
      if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname) || url.pathname.toLowerCase() !== `/${handle}/` || url.search || url.hash) throw new Error();
      const canonical = url.pathname.toLowerCase();
      if (urls.has(canonical)) errors.push(`${at}: duplicate profile URL`);
      urls.add(canonical);
    } catch { errors.push(`${at}: profile URL does not match the Instagram handle`); }
    if (!record.name || !record.reason) errors.push(`${at}: name and reason are required`);
    const unavailableCount = record.urlState === "無効" && (record.followers === "" || record.followers == null);
    if (!unavailableCount && (!Number.isInteger(record.followers) || record.followers < 0)) errors.push(`${at}: follower count must be numeric`);
    if (!["学生団体", "学生メディア", "イベント", "個人", "その他", "ゼミ"].includes(record.type)) errors.push(`${at}: invalid account type`);
    if (!["有効", "未再確認", "無効"].includes(record.urlState)) errors.push(`${at}: invalid URL status`);
    if (!["要確認", "対象外", "送信可"].includes(record.decision)) errors.push(`${at}: invalid outreach decision`);
    if (!["未着手", "送信済", "返信あり", "掲載予定", "掲載済", "保留", "終了", "辞退・連絡不要"].includes(record.progress)) errors.push(`${at}: invalid progress`);
    const checked = isoDate(record.checked);
    if (!checked || checked > asOf) errors.push(`${at}: invalid or future confirmation date`);
    if (record.priority !== "" && record.priority != null) {
      if (!Number.isInteger(record.priority) || record.priority < 1 || priorities.has(record.priority)) errors.push(`${at}: invalid or duplicate priority`);
      priorities.add(record.priority);
    }
    if (record.referralUrl) {
      try {
        const url = new URL(record.referralUrl);
        const ref = url.searchParams.get("ref");
        if (url.origin !== "https://setlog-match-web.vercel.app" || !ref || ref !== record.referralLabel || refs.has(ref)) throw new Error();
        refs.add(ref);
      } catch { errors.push(`${at}: invalid or duplicate referral URL`); }
    }
    if (["送信済", "返信あり", "掲載予定", "掲載済"].includes(record.progress) && (!isoDate(record.contacted) || isoDate(record.contacted) > asOf)) errors.push(`${at}: contact progress requires a valid contact date`);
    if (record.progress === "辞退・連絡不要" && record.decision !== "対象外") errors.push(`${at}: opted-out lead must be excluded`);
    if (record.urlState === "有効") verified++;
    else if (record.urlState === "未再確認") unverified++;
    else if (record.urlState === "無効") invalid++;
    if (record.decision === "対象外") excluded++;
    else if (record.decision === "送信可") {
      sendReady++;
      let hasAlternateContact = false;
      try {
        const contact = new URL(record.contactUrl);
        hasAlternateContact = contact.protocol === "https:" && !contact.username && !contact.password && contact.hostname !== "instagram.com" && !contact.hostname.endsWith(".instagram.com");
      } catch { /* A missing alternate window does not replace a verified profile. */ }
      const hasVerifiedWindow = record.urlState === "有効" || (record.urlState === "無効" && hasAlternateContact);
      if (!["学生団体", "学生メディア", "イベント", "ゼミ"].includes(record.type) || !hasVerifiedWindow || !checked || (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${checked}T00:00:00Z`)) / 86400000 > 30) errors.push(`${at}: send-ready lead requires an eligible partner type and recent verified profile or alternate contact URL`);
    } else pending++;
  }
  if (pending) warnings.push(`${pending} leads still require manual profile/contact review`);
  if (unverified) warnings.push(`${unverified} profile URLs have not been rechecked live`);
  if (invalid) warnings.push(`${invalid} profile URLs were checked and are unavailable`);
  if (strict && pending) errors.push(`Strict: ${pending} non-excluded leads are not send-ready`);
  return { ok: !errors.length, errors, warnings, summary: { rows: rows.length, uniqueProfiles: urls.size, verifiedProfileUrls: verified, profileUrlsNotRechecked: unverified, invalidProfileUrls: invalid, excluded, toReview: pending, sendReady, referralUrls: refs.size } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  const file = fileIndex >= 0 ? path.resolve(args[fileIndex + 1]) : MASTER_WORKBOOK;
  try {
    const workbook = readSalesWorkbook(file);
    const result = validateSalesRows(workbook, { strict: args.includes("--strict") });
    console.log(JSON.stringify({ file, sheets: workbook.sheets, columns: workbook.headers.length, tableCount: workbook.tableCount, sourceNotes: workbook.noteCount, ...result.summary }, null, 2));
    for (const warning of result.warnings) console.warn(`WARN ${warning}`);
    for (const error of result.errors) console.error(`ERROR ${error}`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
