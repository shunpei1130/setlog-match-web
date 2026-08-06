export const PROFILE_YEARS = ["1年", "2年", "3年", "4年", "修士1年", "修士2年", "その他"] as const;
export const PROFILE_GENDERS = ["male", "female", "other"] as const;

export type ProfileYear = (typeof PROFILE_YEARS)[number];
export type ProfileGender = (typeof PROFILE_GENDERS)[number];

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
