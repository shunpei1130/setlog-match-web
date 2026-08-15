import assert from "node:assert/strict";
import test from "node:test";
import { arePairPreferencesCompatible, validateRegistrationPreferences } from "../lib/profile.ts";

test("registration preferences require an explicit purpose and supported gender preference", () => {
  assert.deepEqual(validateRegistrationPreferences(null).missing, ["purpose", "preferredGender"]);
  assert.deepEqual(validateRegistrationPreferences({ purpose: "business", preferredGender: "any" }).invalid, ["purpose"]);
  assert.deepEqual(validateRegistrationPreferences({ purpose: "friend", preferredGender: "any" }).preferences, {
    purpose: "friend",
    preferredGender: "any",
  });
});

test("pair compatibility is mutual for purpose and gender", () => {
  const friend = { gender: "male", purpose: "friend", preferredGender: "female" };
  const compatible = { gender: "female", purpose: "either", preferredGender: "male" };
  const purposeMismatch = { gender: "female", purpose: "romance", preferredGender: "male" };
  const genderMismatch = { gender: "female", purpose: "friend", preferredGender: "female" };

  assert.equal(arePairPreferencesCompatible(friend, compatible), true);
  assert.equal(arePairPreferencesCompatible(friend, purposeMismatch), false);
  assert.equal(arePairPreferencesCompatible(friend, genderMismatch), false);
});
