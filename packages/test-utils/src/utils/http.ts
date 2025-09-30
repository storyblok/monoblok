export const PORT_RANGE_APP =
  process.env.STORYBLOK_TEST_UTILS_PORT_RANGE_APP ?? "3000-3100";

export const PORT_RANGE_STUB_SERVER =
  process.env.STORYBLOK_TEST_UTILS_PORT_RANGE_STUB_SERVER ?? "9000-9100";

export const waitForHTTP = async (
  url: string,
  {
    timeout = 20_000,
    interval = 200,
    method = "GET",
  }: {
    timeout?: number;
    interval?: number;
    method?: string;
  } = {}
): Promise<void> => {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeout) {
    try {
      const controller = new AbortController();
      const perRequestTimeout = setTimeout(
        () => controller.abort(),
        Math.min(5000, timeout)
      );
      const res = await fetch(url, { method, signal: controller.signal });
      clearTimeout(perRequestTimeout);

      if (res.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw lastError;
};

export const parsePortRange = (range: string) => {
  const [start, end] = range.split("-").map(Number);
  if (!start || !end || Number.isNaN(start) || Number.isNaN(end))
    throw new Error(
      `Invalid port range "${range}". The range must be in the format "9000-9100".`
    );

  return { start, end };
};
