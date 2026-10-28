import { expect, it } from "vitest";
import { GET } from "./route";

it("serves an empty, uncached liveness response without touching identity or application data", () => {
  const response = GET();

  expect(response.status).toBe(204);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.body).toBeNull();
});
