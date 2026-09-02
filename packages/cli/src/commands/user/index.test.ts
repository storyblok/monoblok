import chalk from "chalk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userCommand } from "./";
import { getUser } from "./actions";
import { session } from "../../session";
import { loggedOutSessionState } from "../../../test/setup";
import type { User } from "../../types";

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
    const mockResponse: User = {
      id: 1,
      userid: "1",
      friendly_name: "John Doe",
      email: "john.doe@storyblok.com",
      created_at: "2024-01-01T00:00:00Z",
      use_username: false,
      login_strategy: "password",
      has_org: false,
      has_partner: false,
      org: {},
      notified: [],
      favourite_spaces: [],
      favourite_ideas: [],
      beta_user: false,
      track_statistics: true,
      ui_theme: {},
      totp_factor_verified: false,
      configured_2fa_options: ["otp_email"],
      disclaimer_ids: [],
      live_chat_enabled: false,
      confirmed: true,
    };
    vi.mocked(getUser).mockResolvedValue(mockResponse);
    await userCommand.parseAsync(["node", "test"]);

    expect(getUser).toHaveBeenCalledWith("valid-token", "eu");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`Hi ${chalk.bold("John Doe")}`),
    );
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
