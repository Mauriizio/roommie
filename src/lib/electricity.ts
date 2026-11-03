export type Consumption = {
  kwh: number;
  elapsedDays: number;
  averageDailyKwh: number | null;
};

export function consumptionBetween(
  previous: number,
  current: number,
  previousDate: string | Date,
  currentDate: string | Date,
): Consumption | null {
  const kwh = Number(current) - Number(previous);
  if (!Number.isFinite(kwh) || kwh < 0) return null;
  const elapsedDays = Math.floor(
    (new Date(currentDate).getTime() - new Date(previousDate).getTime()) /
      86_400_000,
  );
  if (elapsedDays < 0) return null;
  return {
    kwh: Number(kwh.toFixed(3)),
    elapsedDays,
    averageDailyKwh:
      elapsedDays > 0 ? Number((kwh / elapsedDays).toFixed(3)) : null,
  };
}

export function compareBill(measured: number, billed: number) {
  if (
    !Number.isFinite(measured) ||
    !Number.isFinite(billed) ||
    measured < 0 ||
    billed < 0
  )
    return null;
  return {
    differenceKwh: Number((measured - billed).toFixed(3)),
    differencePercent:
      billed > 0
        ? Number((((measured - billed) / billed) * 100).toFixed(1))
        : null,
  };
}

export function sameBillingPeriod(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  return (
    startA.slice(0, 10) === startB.slice(0, 10) &&
    endA.slice(0, 10) === endB.slice(0, 10)
  );
}
