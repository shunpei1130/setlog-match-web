/** @param {Record<string, string | undefined>} environment */
function validateReleaseConfiguration(environment) {
  const release = environment.EAS_BUILD_PROFILE === "production" || environment.EAS_BUILD_PROFILE === "preview" || environment.SET_MOB_RELEASE === "true";
  if (!release) return false;
  for (const key of ["EXPO_PUBLIC_API_BASE_URL", "EXPO_PUBLIC_REVIEW_API_BASE_URL"]) {
    const raw = environment[key];
    if (!raw) throw new Error(`${key} is required for a release build.`);
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
      || url.pathname !== "/" || /(^|\.)(localhost|local|invalid|test|example|example\.(com|org|net))$/.test(url.hostname)
      || /^(127\.|10\.|192\.168\.|0\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)
      || /^\[(::|::1|f[cd][\da-f]*:|fe80:)/i.test(url.hostname)) {
      throw new Error(`${key} must be a public HTTPS origin.`);
    }
  }
  if (new URL(environment.EXPO_PUBLIC_API_BASE_URL).origin === new URL(environment.EXPO_PUBLIC_REVIEW_API_BASE_URL).origin) throw new Error("Production and review origins must be different.");
  if (environment.EAS_BUILD === "true" && !environment.EAS_PROJECT_ID) throw new Error("EAS_PROJECT_ID is required. Link the existing Expo project first.");
  return true;
}

module.exports = { validateReleaseConfiguration };
