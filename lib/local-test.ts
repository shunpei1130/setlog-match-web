const LOCAL_TEST_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function isLocalTestHostname(hostname: string) {
  return LOCAL_TEST_HOSTS.has(hostname.toLowerCase());
}

export function isLocalTestBrowser() {
  return typeof window !== "undefined" && isLocalTestHostname(window.location.hostname);
}
