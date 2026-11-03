import { describe, expect, it } from "vitest";
import {
  compareBill,
  consumptionBetween,
  sameBillingPeriod,
} from "../src/lib/electricity";

describe("electricidad ROOMMIE", () => {
  it("calcula correctamente el consumo acumulado", () => {
    expect(
      consumptionBetween(
        12450,
        12620,
        "2026-10-20T12:00:00-03:00",
        "2026-11-03T12:00:00-03:00",
      ),
    ).toEqual({ kwh: 170, elapsedDays: 14, averageDailyKwh: 12.143 });
  });
  it("rechaza una lectura acumulada menor sin inventar consumo negativo", () => {
    expect(
      consumptionBetween(12620, 80, "2026-10-20", "2026-11-20"),
    ).toBeNull();
  });
  it("permite comparar solo períodos idénticos", () => {
    expect(
      sameBillingPeriod(
        "2026-10-20",
        "2026-11-20",
        "2026-10-20T12:00:00-03:00",
        "2026-11-20T12:00:00-03:00",
      ),
    ).toBe(true);
    expect(
      sameBillingPeriod("2026-10-20", "2026-11-20", "2026-10-21", "2026-11-20"),
    ).toBe(false);
  });
  it("mantiene una diferencia porcentual indefinida si la boleta informa cero", () => {
    expect(compareBill(25, 0)).toEqual({
      differenceKwh: 25,
      differencePercent: null,
    });
  });
});
