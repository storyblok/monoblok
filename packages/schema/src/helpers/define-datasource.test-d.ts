import { describe, expectTypeOf, it } from "vitest";
import { defineDatasource } from "./define-datasource";

describe("defineDatasource types", () => {
  it("should accept dimensions declared by name and entry_value only", () => {
    const colors = defineDatasource({
      name: "Colors",
      slug: "colors",
      dimensions: [
        { name: "Light Mode", entry_value: "light" },
        { name: "Dark Mode", entry_value: "dark" },
      ],
    });

    expectTypeOf(colors.dimensions[0]).toHaveProperty("entry_value").toEqualTypeOf<string>();
  });

  it("should type the id of a declared dimension as optional", () => {
    const colors = defineDatasource({
      name: "Colors",
      slug: "colors",
      dimensions: [{ name: "Light Mode", entry_value: "light" }],
    });

    expectTypeOf(colors.dimensions[0]).toHaveProperty("id").toEqualTypeOf<number | undefined>();
  });

  it("should accept a dimension as the API returns it", () => {
    defineDatasource({
      name: "Colors",
      slug: "colors",
      dimensions: [
        {
          id: 10,
          name: "Light Mode",
          entry_value: "light",
          datasource_id: 5,
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("should reject a dimension without an entry_value", () => {
    defineDatasource({
      name: "Colors",
      slug: "colors",
      // @ts-expect-error entry_value is required
      dimensions: [{ name: "Light Mode" }],
    });
  });
});
