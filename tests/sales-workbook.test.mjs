import test from "node:test";
import assert from "node:assert/strict";
import { SALES_HEADERS, validateSalesRows, readXlsxEntries } from "../scripts/validate-sales-workbook.mjs";

const row = (extra = {}) => ({ row: 8, priority: 1, name: "青学サンプル団体", handle: "@sample.agu", type: "学生団体", followers: 100, urlState: "有効", checked: "2026-10-22", decision: "要確認", reason: "外部企画の受付は未確認。", referralLabel: "sample-agu", referralUrl: "https://setlog-match-web.vercel.app/?ref=sample-agu", progress: "未着手", contacted: "", profileUrl: "https://www.instagram.com/sample.agu/", ...extra });
const validate = (rows, extra = {}) => validateSalesRows({ headers: SALES_HEADERS, rows }, { asOf: "2026-10-23", ...extra });

test("a reachable profile does not make an outreach lead send-ready", () => {
  const result = validate([row()]);
  assert.equal(result.ok, true);
  assert.equal(result.summary.verifiedProfileUrls, 1);
  assert.equal(result.summary.sendReady, 0);
  assert.equal(validate([row()], { strict: true }).ok, false);
});

test("case variants and repeated profile destinations are duplicates", () => {
  const result = validate([row(), row({ row: 9, priority: "", handle: "@SAMPLE.AGU", referralLabel: "", referralUrl: "" })]);
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes("duplicate handle")));
  assert(result.errors.some(error => error.includes("duplicate profile URL")));
});

test("a valid Instagram domain with a different account or post URL fails", () => {
  assert.equal(validate([row({ profileUrl: "https://www.instagram.com/another/" })]).ok, false);
  assert.equal(validate([row({ profileUrl: "https://www.instagram.com/p/example/" })]).ok, false);
  assert.equal(validate([row({ profileUrl: "https://instagram.com.example.org/sample.agu/" })]).ok, false);
});

test("a stale or unverified URL cannot support send-ready status", () => {
  assert.equal(validate([row({ decision: "送信可", checked: "2026-08-19" })]).ok, false);
  assert.equal(validate([row({ decision: "送信可", urlState: "未再確認" })]).ok, false);
  assert.equal(validate([row({ decision: "送信可", type: "個人" })]).ok, false);
  assert.equal(validate([row({ decision: "送信可", type: "その他" })]).ok, false);
});

test("unavailable checked URLs are distinct from URLs awaiting a live check", () => {
  const result = validate([
    row({ decision: "対象外", urlState: "無効" }),
    row({ row: 9, priority: "", handle: "@another.agu", profileUrl: "https://www.instagram.com/another.agu/", referralLabel: "", referralUrl: "", decision: "対象外", urlState: "未再確認" }),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.summary.invalidProfileUrls, 1);
  assert.equal(result.summary.profileUrlsNotRechecked, 1);
  assert.equal(validate([row({ decision: "送信可", urlState: "無効" })]).ok, false);
});

test("a verified alternate window can preserve readiness while the old profile stays unavailable", () => {
  const result = validate([row({ type: "ゼミ", decision: "送信可", urlState: "無効", contactUrl: "https://seminar.example/contact" })], { strict: true });
  assert.equal(result.ok, true);
  assert.equal(result.summary.sendReady, 1);
  assert.equal(result.summary.invalidProfileUrls, 1);
  assert.equal(result.summary.verifiedProfileUrls, 0);
});

test("an unavailable profile can leave its current follower count unknown without inventing zero", () => {
  assert.equal(validate([row({ decision: "対象外", urlState: "無効", followers: "" })]).ok, true);
  assert.equal(validate([row({ followers: "" })]).ok, false);
});

test("alternate windows do not bypass fresh checks or turn an unavailable Instagram link into a verified route", () => {
  for (const contactUrl of ["", "https://www.instagram.com/sample.agu/", "http://seminar.example/contact", "https://user:password@seminar.example/contact"]) {
    assert.equal(validate([row({ decision: "送信可", urlState: "無効", contactUrl })]).ok, false);
  }
  assert.equal(validate([row({ decision: "送信可", urlState: "無効", contactUrl: "https://seminar.example/contact", checked: "2026-08-19" })]).ok, false);
  assert.equal(validate([row({ decision: "送信可", urlState: "未再確認", contactUrl: "https://seminar.example/contact" })]).ok, false);
});

test("sent status needs a real date and opt-outs cannot remain contactable", () => {
  assert.equal(validate([row({ progress: "送信済" })]).ok, false);
  assert.equal(validate([row({ progress: "送信済", contacted: "2026-10-23" })]).ok, true);
  assert.equal(validate([row({ progress: "辞退・連絡不要" })]).ok, false);
  assert.equal(validate([row({ progress: "辞退・連絡不要", decision: "対象外" })]).ok, true);
});

test("unknown URLs on excluded historical records do not imply verified URLs", () => {
  const result = validate([row({ decision: "対象外", urlState: "未再確認", checked: "2026-08-19" })], { strict: true });
  assert.equal(result.ok, true);
  assert.equal(result.summary.verifiedProfileUrls, 0);
  assert.equal(result.summary.excluded, 1);
});

test("duplicate referral codes and invalid dates are rejected", () => {
  assert.equal(validate([row(), row({ row: 9, priority: 2, handle: "@other.agu", profileUrl: "https://www.instagram.com/other.agu/" })]).ok, false);
  assert.equal(validate([row({ checked: "2026-02-30" })]).ok, false);
  assert.equal(validate([row({ checked: "2026-10-24" })]).ok, false);
});

test("the workbook reader rejects non-ZIP input", () => {
  assert.throws(() => readXlsxEntries(Buffer.from("not a workbook")), /valid XLSX/);
});
