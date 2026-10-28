import { afterEach, expect, it, vi } from "vitest";
import { createMonitoringCache } from "./monitoring-cache";

afterEach(() => vi.useRealTimers());

it("coalesces simultaneous scrapes and refreshes after two minutes", async () => {
  vi.useFakeTimers();
  const cache = createMonitoringCache<number>();
  const read = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
  expect(await Promise.all([cache.get(read), cache.get(read)])).toEqual([1, 1]);
  await vi.advanceTimersByTimeAsync(119_999);
  expect(await cache.get(read)).toBe(1);
  expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await cache.get(read)).toBe(2);
  expect(read).toHaveBeenCalledTimes(2);
});

it("retries failed or unavailable collections without serving stale success", async () => {
  vi.useFakeTimers();
  const cache = createMonitoringCache<number>();
  const read = vi
    .fn()
    .mockResolvedValueOnce(1)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(2);
  const collect = () => cache.get(read, (value) => value > 0);
  await collect();
  await vi.advanceTimersByTimeAsync(120_000);
  await expect(collect()).rejects.toThrow("offline");
  expect(await collect()).toBe(0);
  expect(await collect()).toBe(2);
  expect(read).toHaveBeenCalledTimes(4);
});

it("does not repopulate an invalidated snapshot from an older in-flight read", async () => {
  const cache = createMonitoringCache<number>();
  let finish!: (value: number) => void;
  const old = cache.get(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  await Promise.resolve();
  cache.clear();
  expect(await cache.get(async () => 2)).toBe(2);
  finish(1);
  expect(await old).toBe(1);
  expect(await cache.get(async () => 3)).toBe(2);
});
