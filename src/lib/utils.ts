export const dateInput = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Santiago",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((x) => x.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
export const zonedDateToISO = (date: string, time = "12:00") => {
  const [year, month, day] = date.split("-").map(Number),
    [hour, minute] = time.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcGuess));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((x) => x.type === type)?.value ?? 0);
  const localAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return new Date(utcGuess - (localAsUTC - utcGuess)).toISOString();
};
export const formatDate = (date?: string | null) => {
  if (!date) return "—";
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(zonedDateToISO(date))
    : new Date(date);
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeZone: "America/Santiago",
  }).format(value);
};
export const timeAgo = (date?: string | null) => {
  if (!date) return "Sin registros aún";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
};
export const nextReminder = (day: number) => {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }),
  );
  const year = now.getFullYear(),
    month = now.getMonth();
  let next = new Date(
    year,
    month,
    Math.min(day, new Date(year, month + 1, 0).getDate()),
    12,
  );
  if (next < now)
    next = new Date(
      year,
      month + 1,
      Math.min(day, new Date(year, month + 2, 0).getDate()),
      12,
    );
  return next;
};
export const relativeDayCount = (date: Date) =>
  Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
export const initials = (name = "R") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
export const pictureUrl = async (
  supabase: ReturnType<typeof import("./supabase/client").createClient>,
  path: string | null,
) => {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("roommie-private")
    .createSignedUrl(path, 180);
  return data?.signedUrl ?? null;
};
