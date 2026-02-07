const DAY_ORDER = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

type OpenStatus = {
  isOpen: boolean;
  label: string;
};

function parseTimeToMinutes(time?: string | null) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayKeyFromIndex(index: number) {
  return DAY_ORDER[index % 7];
}

function isDayOpen(openDays: string[] | null, index: number) {
  if (!openDays || openDays.length === 0) return true;
  return openDays.includes(dayKeyFromIndex(index));
}

export function getGymOpenStatus(params: {
  openTime?: string | null;
  closeTime?: string | null;
  openDays?: string | null;
  now?: Date;
  useIst?: boolean;
}): OpenStatus {
  const now =
    params.now ??
    (params.useIst
      ? new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
      : new Date());
  const openTimeMinutes = parseTimeToMinutes(params.openTime);
  const closeTimeMinutes = parseTimeToMinutes(params.closeTime);
  const days = params.openDays
    ? params.openDays.split(",").map((d) => d.trim().toUpperCase()).filter(Boolean)
    : null;

  if (openTimeMinutes == null || closeTimeMinutes == null) {
    return { isOpen: false, label: "Hours not listed" };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIndex = now.getDay();
  const yesterdayIndex = (todayIndex + 6) % 7;
  const overnight = closeTimeMinutes <= openTimeMinutes;

  const openToday = isDayOpen(days, todayIndex);
  const openYesterday = isDayOpen(days, yesterdayIndex);

  let isOpen = false;
  if (!overnight) {
    isOpen = openToday && nowMinutes >= openTimeMinutes && nowMinutes < closeTimeMinutes;
  } else {
    isOpen = (openToday && nowMinutes >= openTimeMinutes) ||
      (openYesterday && nowMinutes < closeTimeMinutes);
  }

  if (isOpen) {
    return { isOpen: true, label: "Open now" };
  }

  const nextOpen = new Date(now);
  for (let i = 0; i < 7; i += 1) {
    const dayIndex = (todayIndex + i) % 7;
    if (!isDayOpen(days, dayIndex)) {
      nextOpen.setDate(nextOpen.getDate() + 1);
      continue;
    }
    const openDate = new Date(now);
    openDate.setDate(now.getDate() + i);
    openDate.setHours(Math.floor(openTimeMinutes / 60), openTimeMinutes % 60, 0, 0);
    if (i === 0 && nowMinutes < openTimeMinutes) {
      return { isOpen: false, label: `Closed · Opens at ${formatTime(openDate)}` };
    }
    if (i > 0) {
      const dayLabel = openDate.toLocaleDateString([], { weekday: "short" });
      return { isOpen: false, label: `Closed · Opens ${dayLabel} at ${formatTime(openDate)}` };
    }
  }

  return { isOpen: false, label: "Closed" };
}
