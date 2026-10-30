import { AppProvider, useApp } from "@/context/app-context";
import { ApiError, mobileApi } from "@/lib/api";
import { clearAccessToken, readAccessToken } from "@/lib/storage";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  mobileApi: { me: jest.fn(), lineStatus: jest.fn(), participation: jest.fn() },
}));
jest.mock("@/lib/storage", () => ({
  ...jest.requireActual("@/lib/storage"),
  readAccessToken: jest.fn(), clearAccessToken: jest.fn().mockResolvedValue(undefined),
  restoreApiEnvironment: jest.fn().mockResolvedValue(undefined),
}));

function Probe() {
  const app = useApp();
  return <Text>{`${app.phase}:${app.busy ? "busy" : "idle"}`}</Text>;
}

test("保存済みのセッションが失効しても、処理中を解除して再認証できる", async () => {
  jest.mocked(readAccessToken).mockResolvedValue("expired-test-session");
  jest.mocked(mobileApi.me).mockRejectedValue(new ApiError(401, "AUTH_REQUIRED"));
  jest.mocked(mobileApi.lineStatus).mockRejectedValue(new ApiError(401, "AUTH_REQUIRED"));
  jest.mocked(mobileApi.participation).mockRejectedValue(new ApiError(401, "AUTH_REQUIRED"));
  const screen = await render(<AppProvider><Probe /></AppProvider>);
  expect(await screen.findByText("landing:idle")).toBeTruthy();
  expect(clearAccessToken).toHaveBeenCalledTimes(1);
});
