export function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function occursOn(entry, date) {
  if (entry.startDate && date < entry.startDate) return false;
  if (entry.endDate && date > entry.endDate) return false;
  if (entry.mode === "range") return Boolean(entry.startDate && entry.endDate);
  if (entry.mode === "weekly")
    return (
      entry.dayOfWeek?.includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ??
      false
    );
  return false;
}
export function monthDays(month) {
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => {
    const date = new Date(Date.UTC(year, number - 1, 1 - offset + i))
      .toISOString()
      .slice(0, 10);
    return { date, outside: !date.startsWith(month) };
  });
}
export function changeMonth(month, difference) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + difference, 1))
    .toISOString()
    .slice(0, 7);
}
