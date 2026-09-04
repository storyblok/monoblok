import chalk from "chalk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userCommand } from "./";
import { getUser } from "./actions";
import { session } from "../../session";
import { loggedOutSessionState } from "../../../test/setup";

vi.mock("./actions", () => ({
  getUser: vi.fn(),
}));

vi.mock("../../creds", () => ({
  isAuthorized: vi.fn(),
}));

const preconditions = {
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
};

describe("userCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should show the user information", async () => {
    const mockResponse = {
      id: 1,
      friendly_name: "John Doe",
      email: "john.doe@storyblok.com",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    vi.mocked(getUser).mockResolvedValue(mockResponse);
    await userCommand.parseAsync(["node", "test"]);

    expect(getUser).toHaveBeenCalledWith({ personalAccessToken: "valid-token" }, "eu");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`Hi ${chalk.bold("John Doe")}`),
    );
  });

  it("should fetch the user with the OAuth access token for an OAuth session", async () => {
    // Far-future expiry so the program preAction hook does not attempt a token refresh.
    const oauthState = {
      isLoggedIn: true,
      region: "eu" as const,
      authType: "oauth" as const,
      oauthAccessToken: "oat-token",
      oauthExpiresAt: "2099-01-01T00:00:00.000Z",
      envLogin: false,
    };
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = { ...oauthState };
    });
    session().state = { ...oauthState };
    vi.mocked(getUser).mockResolvedValue({
      id: 1,
      friendly_name: "John Doe",
      email: "john.doe@storyblok.com",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });

    await userCommand.parseAsync(["node", "test"]);

    expect(getUser).toHaveBeenCalledWith({ oauthToken: "oat-token" }, "eu");
  });

  it("should show an error if the user is not logged in", async () => {
    preconditions.loggedOut();

    await userCommand.parseAsync(["node", "test"]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("You are currently not logged in"),
    );
  });

  it("should show an error if the user information cannot be fetched", async () => {
    const mockError = new Error("Network error");

    vi.mocked(getUser).mockRejectedValue(mockError);

    await userCommand.parseAsync(["node", "test"]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Network error"));
  });
});
