import { describe, expect, it } from "vitest";
import { billSchema, purchaseSchema, readingSchema } from "../src/lib/validation";

describe("validación de registros compartidos", () => {
  it("rechaza cantidades no positivas y acepta una unidad opcional", () => {
    expect(
      purchaseSchema.safeParse({
        purchasedAt: "2026-11-03",
        quantity: 0,
        unit: "litro",
        notes: null,
      }).success,
    ).toBe(false);
    expect(
      purchaseSchema.safeParse({
        purchasedAt: "2026-11-03",
        quantity: 1,
        unit: "litro",
        notes: null,
      }).success,
    ).toBe(true);
  });

  it("rechaza lecturas acumuladas negativas", () => {
    expect(
      readingSchema.safeParse({
        readAt: "2026-11-03T15:00:00.000Z",
        valueKwh: -1,
        notes: null,
      }).success,
    ).toBe(false);
  });

  it("valida el orden de fechas de una boleta", () => {
    expect(
      billSchema.safeParse({
        issuedAt: "2026-11-03",
        periodStart: "2026-11-20",
        periodEnd: "2026-10-20",
        initialReadingKwh: null,
        finalReadingKwh: null,
        billedKwh: null,
        amountClp: null,
        otherChargesClp: null,
        notes: null,
      }).success,
    ).toBe(false);
  });
});
