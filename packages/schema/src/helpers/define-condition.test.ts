import { describe, expect, it } from "vitest";
import { hideWhen, requiredWhen } from "./define-condition";

describe("hideWhen", () => {
  it("should build the display modification the editor writes", () => {
    expect(hideWhen({ field: "show_cta", is: "empty" })).toEqual({
      modifications: [{ display: "hide" }],
      rule_match: "all",
      rule_conditions: [
        {
          validated_object: { type: "field", field_key: "show_cta", field_attr: "value" },
          validation: "empty",
        },
      ],
    });
  });

  it("should omit `value` when the comparison ignores it", () => {
    const [condition] = hideWhen({ field: "show_cta", is: "not_empty" }).rule_conditions!;
    expect(condition).not.toHaveProperty("value");
  });

  it("should keep a falsy comparison value", () => {
    const [condition] = hideWhen({ field: "count", is: "equals", value: 0 }).rule_conditions!;
    expect(condition.value).toBe(0);
  });

  it("should require every condition by default and honor an explicit match", () => {
    const conditions = [
      { field: "a", is: "not_empty" },
      { field: "b", is: "not_empty" },
    ] as const;

    expect(hideWhen([...conditions]).rule_match).toBe("all");
    expect(hideWhen([...conditions], { match: "any" }).rule_match).toBe("any");
    expect(hideWhen([...conditions]).rule_conditions).toHaveLength(2);
  });
});

describe("requiredWhen", () => {
  it("should build the required modification", () => {
    expect(requiredWhen({ field: "region", is: "equals", value: "eu" })).toEqual({
      modifications: [{ required: true }],
      rule_match: "all",
      rule_conditions: [
        {
          validated_object: { type: "field", field_key: "region", field_attr: "value" },
          validation: "equals",
          value: "eu",
        },
      ],
    });
  });
});
