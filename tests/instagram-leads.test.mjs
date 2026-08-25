import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, normalizeHandle, validateLeads } from "../scripts/validate-instagram-leads.mjs";

test("normalizes Instagram handles without changing the original CSV value", () => {
  assert.equal(normalizeHandle(" @Setlog.Match "), "setlog.match");
});

test("parses quoted commas and line endings", () => {
  const parsed = parseCsv('instagram_username,aoyama_evidence\nfoo,"プロフィールに、青学と明記"\n');
  assert.equal(parsed.records[0].aoyama_evidence, "プロフィールに、青学と明記");
});

test("accepts a complete eligible DM candidate", () => {
  const parsed = parseCsv([
    "instagram_username,profile_url,display_name,follower_count,follower_count_display,account_type,public_status,aoyama_signal,discovery_channel,source_account,aoyama_evidence,evidence_url,confidence,last_checked_at,adult_service_eligibility,dm_status,owner,notes",
    "sample.account,https://www.instagram.com/sample.account/,Sample,1200,1.2万,individual,public,profile_explicit,keyword_search,,プロフィールに青学と明記,https://www.instagram.com/sample.account/,A,2026-08-11,eligible,candidate,,",
  ].join("\n"));
  const result = validateLeads(parsed);
  assert.equal(result.ok, true);
  assert.equal(result.summary.dmReady, 1);
});

test("rejects duplicates and unsafe DM candidates", () => {
  const parsed = parseCsv([
    "instagram_username,profile_url,display_name,follower_count,follower_count_display,account_type,public_status,aoyama_signal,discovery_channel,source_account,aoyama_evidence,evidence_url,confidence,last_checked_at,adult_service_eligibility,dm_status,owner,notes",
    "@same,https://www.instagram.com/same/,Same,100,100,individual,private,ambiguous_context,keyword_search,,青山という表記のみ,https://example.com/evidence,A,2026-08-11,unknown,candidate,,",
    "same,https://www.instagram.com/same/,Same 2,200,200,individual,public,profile_explicit,hashtag,,プロフィールに青学と明記,https://www.instagram.com/same/,A,2026-08-11,eligible,candidate,,",
  ].join("\n"));
  const result = validateLeads(parsed);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.includes("duplicate")), true);
  assert.equal(result.warnings.some((warning) => warning.includes("non-public/unknown")), true);
});

test("strict validation accepts a verified list larger than the minimum target", () => {
  const headers = "instagram_username,profile_url,display_name,follower_count,follower_count_display,account_type,public_status,aoyama_signal,discovery_channel,source_account,aoyama_evidence,evidence_url,confidence,last_checked_at,adult_service_eligibility,dm_status,owner,notes";
  const rows = Array.from({ length: 1000 }, (_, index) => `sample${index},https://www.instagram.com/sample${index}/,Sample ${index},100,100,student_media,public,profile_explicit,keyword_search,,プロフィールに青学と明記,https://www.instagram.com/sample${index}/,A,2026-08-11,unknown,not_checked,,`);
  const result = validateLeads(parseCsv([headers, ...rows, rows[0].replace("sample0", "sample1000")].join("\n")), { strict: true });
  assert.equal(result.ok, true);
  assert.equal(result.summary.rows, 1001);
});
