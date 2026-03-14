import { describe, expect, test } from "bun:test";
import { reorderItems } from "../../frontend/src/utils/reorder.ts";

describe("reorderItems", () => {
  test("should move a playlist item to a new index", () => {
    expect(reorderItems(["a", "b", "c", "d"], 3, 1)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  test("should return a shallow copy when indexes match", () => {
    const items = ["a", "b", "c"];
    const reordered = reorderItems(items, 1, 1);

    expect(reordered).toEqual(items);
    expect(reordered).not.toBe(items);
  });

  test("should reject invalid indexes", () => {
    expect(() => reorderItems(["a"], 0, 2)).toThrow("Invalid reorder indexes");
  });
});
