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
