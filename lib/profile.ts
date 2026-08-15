export const PROFILE_YEARS = ["1年", "2年", "3年", "4年", "修士1年", "修士2年", "その他"] as const;
export const PROFILE_GENDERS = ["male", "female", "other"] as const;
export const MATCH_PURPOSES = ["friend", "romance", "either"] as const;
export const GENDER_PREFERENCES = ["any", "male", "female", "other"] as const;

export type ProfileYear = (typeof PROFILE_YEARS)[number];
export type ProfileGender = (typeof PROFILE_GENDERS)[number];
export type MatchPurpose = (typeof MATCH_PURPOSES)[number];
export type GenderPreference = (typeof GENDER_PREFERENCES)[number];

export type RegistrationProfile = {
  nickname: string;
  faculty: string;
  academicYear: ProfileYear;
  gender: ProfileGender;
};

export type ProfileField = keyof RegistrationProfile;

export type ContactHandles = {
  instagramHandle: string | null;
  lineContact: string | null;
};

export type ContactField = keyof ContactHandles;

export type RegistrationPreferences = {
  purpose: MatchPurpose;
  preferredGender: GenderPreference;
};

export type PreferenceField = keyof RegistrationPreferences;

export function validateRegistrationProfile(input: unknown): {
  profile: RegistrationProfile | null;
  missing: ProfileField[];
  invalid: ProfileField[];
} {
  if (!input || typeof input !== "object") {
    return { profile: null, missing: ["nickname", "faculty", "academicYear", "gender"], invalid: [] };
  }

  const candidate = input as Partial<Record<ProfileField, unknown>>;
  const nickname = typeof candidate.nickname === "string" ? candidate.nickname.trim() : "";
  const faculty = typeof candidate.faculty === "string" ? candidate.faculty.trim() : "";
  const academicYear = typeof candidate.academicYear === "string" ? candidate.academicYear : "";
  const gender = typeof candidate.gender === "string" ? candidate.gender : "";
  const missing: ProfileField[] = [];
  const invalid: ProfileField[] = [];

  if (!nickname) missing.push("nickname");
  else if (nickname.length > 20) invalid.push("nickname");
  if (!faculty) missing.push("faculty");
  else if (faculty.length > 40) invalid.push("faculty");
  if (!academicYear) missing.push("academicYear");
  else if (!(PROFILE_YEARS as readonly string[]).includes(academicYear)) invalid.push("academicYear");
  if (!gender) missing.push("gender");
  else if (!(PROFILE_GENDERS as readonly string[]).includes(gender)) invalid.push("gender");

  if (missing.length > 0 || invalid.length > 0) {
    return { profile: null, missing, invalid };
  }

  return {
    profile: {
      nickname,
      faculty,
      academicYear: academicYear as ProfileYear,
      gender: gender as ProfileGender,
    },
    missing,
    invalid,
  };
}

export function validateRegistrationPreferences(input: unknown): {
  preferences: RegistrationPreferences | null;
  missing: PreferenceField[];
  invalid: PreferenceField[];
} {
  if (!input || typeof input !== "object") {
    return { preferences: null, missing: ["purpose", "preferredGender"], invalid: [] };
  }
  const candidate = input as Partial<Record<PreferenceField, unknown>>;
  const purpose = typeof candidate.purpose === "string" ? candidate.purpose : "";
  const preferredGender = typeof candidate.preferredGender === "string" ? candidate.preferredGender : "";
  const missing: PreferenceField[] = [];
  const invalid: PreferenceField[] = [];
  if (!purpose) missing.push("purpose");
  else if (!(MATCH_PURPOSES as readonly string[]).includes(purpose)) invalid.push("purpose");
  if (!preferredGender) missing.push("preferredGender");
  else if (!(GENDER_PREFERENCES as readonly string[]).includes(preferredGender)) invalid.push("preferredGender");
  if (missing.length > 0 || invalid.length > 0) return { preferences: null, missing, invalid };
  return {
    preferences: {
      purpose: purpose as MatchPurpose,
      preferredGender: preferredGender as GenderPreference,
    },
    missing,
    invalid,
  };
}

export function arePairPreferencesCompatible(
  left: Pick<RegistrationProfile, "gender"> & RegistrationPreferences,
  right: Pick<RegistrationProfile, "gender"> & RegistrationPreferences,
) {
  const purposeCompatible = left.purpose === "either"
    || right.purpose === "either"
    || left.purpose === right.purpose;
  const leftGenderCompatible = left.preferredGender === "any" || left.preferredGender === right.gender;
  const rightGenderCompatible = right.preferredGender === "any" || right.preferredGender === left.gender;
  return purposeCompatible && leftGenderCompatible && rightGenderCompatible;
}

export function validateContactHandles(input: unknown): {
  contacts: ContactHandles;
  invalid: ContactField[];
} {
  const candidate = input && typeof input === "object"
    ? input as Partial<Record<ContactField, unknown>>
    : {};
  const instagramHandle = typeof candidate.instagramHandle === "string"
    ? candidate.instagramHandle.trim().replace(/^@/, "")
    : "";
  const lineContact = typeof candidate.lineContact === "string"
    ? candidate.lineContact.trim()
    : "";
  const invalid: ContactField[] = [];

  if (instagramHandle.length > 40 || (instagramHandle && !/^[A-Za-z0-9._]{1,40}$/.test(instagramHandle))) {
    invalid.push("instagramHandle");
  }
  if (lineContact.length > 120) invalid.push("lineContact");

  return {
    contacts: {
      instagramHandle: instagramHandle || null,
      lineContact: lineContact || null,
    },
    invalid,
  };
}
