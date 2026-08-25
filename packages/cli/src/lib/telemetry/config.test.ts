import { describe, expect, it } from "vitest";
import { isCiEnvironment, resolveTelemetrySettings } from "./config";
import { DEFAULT_DATASET, DEFAULT_OTLP_ENDPOINT, DEFAULT_SERVICE_NAME } from "./constants";

const withToken = { DASH0_TOKEN: "ingest-token" } as NodeJS.ProcessEnv;

describe("resolveTelemetrySettings", () => {
  it("should stay off when nothing opts in", () => {
    expect(resolveTelemetrySettings({ env: withToken })).toBeNull();
  });

  it("should stay off when DO_NOT_TRACK is set, even after an explicit opt-in", () => {
    expect(
      resolveTelemetrySettings({ enabled: true, env: { ...withToken, DO_NOT_TRACK: "1" } }),
    ).toBeNull();
  });

  it("should keep debug alive under DO_NOT_TRACK, but with nothing to export", () => {
    expect(
      resolveTelemetrySettings({
        enabled: true,
        debug: true,
        env: { ...withToken, DO_NOT_TRACK: "1" },
      }),
    ).toMatchObject({ token: "", debug: true, exportDisabledReason: "do-not-track" });
  });

  it("should let debug run without a token, and say why nothing is exported", () => {
    expect(
      resolveTelemetrySettings({ debug: true, env: { STORYBLOK_TELEMETRY_ENABLED: "1" } }),
    ).toMatchObject({ token: "", debug: true, exportDisabledReason: "no-token" });
  });

  it("should report an opt-out as the reason when only debug is on", () => {
    expect(resolveTelemetrySettings({ debug: true, env: withToken })).toMatchObject({
      token: "",
      debug: true,
      exportDisabledReason: "opted-out",
    });
  });

  it("should both export and print when debug accompanies an opt-in", () => {
    const settings = resolveTelemetrySettings({ enabled: true, debug: true, env: withToken });

    expect(settings).toMatchObject({ token: "ingest-token", debug: true });
    expect(settings).not.toHaveProperty("exportDisabledReason");
  });

  it("should turn debug on through the environment", () => {
    expect(resolveTelemetrySettings({ env: { STORYBLOK_TELEMETRY_DEBUG: "1" } })).toMatchObject({
      debug: true,
    });
  });

  it("should let an explicit debug opt-out win over the environment", () => {
    expect(
      resolveTelemetrySettings({ debug: false, env: { STORYBLOK_TELEMETRY_DEBUG: "1" } }),
    ).toBeNull();
  });

  it("should stay off when the config opts out, even with the environment opting in", () => {
    expect(
      resolveTelemetrySettings({
        enabled: false,
        env: { ...withToken, STORYBLOK_TELEMETRY_ENABLED: "1" },
      }),
    ).toBeNull();
  });

  it("should stay off when there is no token to authenticate with", () => {
    expect(resolveTelemetrySettings({ enabled: true, env: {} })).toBeNull();
  });

  it("should resolve platform defaults for an explicit opt-in", () => {
    expect(resolveTelemetrySettings({ enabled: true, env: withToken })).toEqual({
      endpoint: DEFAULT_OTLP_ENDPOINT,
      token: "ingest-token",
      dataset: DEFAULT_DATASET,
      serviceName: DEFAULT_SERVICE_NAME,
      debug: false,
    });
  });

  it("should opt in through the environment when no flag or config file decided", () => {
    expect(
      resolveTelemetrySettings({ env: { ...withToken, STORYBLOK_TELEMETRY_ENABLED: "true" } }),
    ).not.toBeNull();
  });

  it("should let the environment override endpoint, dataset and service name", () => {
    expect(
      resolveTelemetrySettings({
        enabled: true,
        env: {
          ...withToken,
          OTEL_EXPORTER_OTLP_ENDPOINT: "https://ingress.example.com/",
          DASH0_DATASET: "dev-storyblok",
          OTEL_SERVICE_NAME: "storyblok-cli-dev",
        },
      }),
    ).toEqual({
      endpoint: "https://ingress.example.com",
      token: "ingest-token",
      dataset: "dev-storyblok",
      serviceName: "storyblok-cli-dev",
      debug: false,
    });
  });
});

describe("isCiEnvironment", () => {
  it("should detect a generic CI flag", () => {
    expect(isCiEnvironment({ CI: "true" })).toBe(true);
  });

  it("should detect a vendor-specific CI flag", () => {
    expect(isCiEnvironment({ GITHUB_ACTIONS: "true" })).toBe(true);
  });

  it("should report a plain workstation as not CI", () => {
    expect(isCiEnvironment({})).toBe(false);
  });
});
