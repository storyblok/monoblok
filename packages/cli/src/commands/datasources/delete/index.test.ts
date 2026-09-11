import { deleteDatasource } from "./actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../index";
import { datasourcesCommand } from "../command";
import { fetchDatasource } from "../pull/actions";
import { confirm } from "@inquirer/prompts";

const loggerInfoMock = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/logger/logger", () => ({
  getLogger: () => ({
    info: loggerInfoMock,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    transports: [],
  }),
  setLoggerTransports: vi.fn(),
}));

vi.mock("./actions", () => ({
  deleteDatasource: vi.fn(),
}));

vi.mock("../pull/actions", () => ({
  fetchDatasource: vi.fn(),
}));

vi.mock("../../../creds", () => ({
  getCredentials: vi.fn(),
  addCredentials: vi.fn(),
  removeCredentials: vi.fn(),
  removeAllCredentials: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
}));

describe("datasources delete command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    loggerInfoMock.mockReset();
    // Reset the option values
    Reflect.set(datasourcesCommand, "_optionValues", {});
    for (const command of datasourcesCommand.commands) {
      Reflect.set(command, "_optionValues", {});
    }
  });

  it("should delete a datasource by id", async () => {
    vi.mocked(deleteDatasource).mockResolvedValue(undefined);
    await datasourcesCommand.parseAsync([
      "node",
      "test",
      "delete",
      "--space",
      "12345",
      "--id",
      "45678",
    ]);
    expect(deleteDatasource).toHaveBeenCalledWith("12345", "45678");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("45678"));
  });

  it("should log start and finish events", async () => {
    vi.mocked(deleteDatasource).mockResolvedValue(undefined);
    await datasourcesCommand.parseAsync([
      "node",
      "test",
      "delete",
      "--space",
      "12345",
      "--id",
      "45678",
    ]);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      "Deleting datasource started",
      expect.objectContaining({ space: "12345", id: "45678" }),
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      "Deleting datasource finished",
      expect.objectContaining({ space: "12345", id: "45678" }),
    );
  });

  it("should delete a datasource by name", async () => {
    vi.mocked(fetchDatasource).mockResolvedValue({
      id: 45678,
      name: "Countries",
      slug: "countries",
      created_at: "2021-01-01",
      updated_at: "2021-01-01",
      dimensions: [],
    });
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(deleteDatasource).mockResolvedValue(undefined);
    await datasourcesCommand.parseAsync([
      "node",
      "test",
      "delete",
      "Countries",
      "--space",
      "12345",
    ]);
    expect(deleteDatasource).toHaveBeenCalledWith("12345", "45678");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Countries"));
  });

  it("should prompt the user with a warning if both name and id are provided", async () => {
    await datasourcesCommand.parseAsync([
      "node",
      "test",
      "delete",
      "Countries",
      "--space",
      "12345",
      "--id",
      "45678",
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Both a datasource name and an id were provided"),
    );
  });
});
