"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { updateCheckInSchedule } from "@/actions/check-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const weekdays = [
  { id: 1, label: "Montag" },
  { id: 2, label: "Dienstag" },
  { id: 3, label: "Mittwoch" },
  { id: 4, label: "Donnerstag" },
  { id: 5, label: "Freitag" },
  { id: 6, label: "Samstag" },
  { id: 7, label: "Sonntag" },
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatIcsDate(date: Date) {
  return (
    date.getUTCFullYear() +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate()) +
    "T" +
    pad2(date.getUTCHours()) +
    pad2(date.getUTCMinutes()) +
    pad2(date.getUTCSeconds()) +
    "Z"
  );
}

function computeNextOccurrence(weekday: number, time: string) {
  const [hh, mm] = time.split(":").map((part) => Number(part));
  const now = new Date();

  // JS: Sunday=0..Saturday=6, our weekday: Monday=1..Sunday=7
  const target = weekday % 7; // Sunday=0
  const today = now.getDay();

  let delta = target - today;
  if (delta < 0) delta += 7;

  const next = new Date(now);
  next.setDate(now.getDate() + delta);
  next.setHours(hh, mm, 0, 0);

  // If it's today but already passed, move to next week.
  if (delta === 0 && next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}

function buildIcs({
  title,
  description,
  weekday,
  time,
  durationMinutes,
}: {
  title: string;
  description: string;
  weekday: number;
  time: string;
  durationMinutes: number;
}) {
  const nextStart = computeNextOccurrence(weekday, time);
  const nextEnd = new Date(nextStart.getTime() + durationMinutes * 60 * 1000);
  const byday = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"][weekday - 1];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OKR fuer Paare//Check-in//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(nextStart)}`,
    `DTEND:${formatIcsDate(nextEnd)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

function buildGoogleCalendarUrl({
  title,
  details,
  weekday,
  time,
  durationMinutes,
}: {
  title: string;
  details: string;
  weekday: number;
  time: string;
  durationMinutes: number;
}) {
  const start = computeNextOccurrence(weekday, time);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const toGoogleDate = (date: Date) => {
    return (
      date.getUTCFullYear() +
      pad2(date.getUTCMonth() + 1) +
      pad2(date.getUTCDate()) +
      "T" +
      pad2(date.getUTCHours()) +
      pad2(date.getUTCMinutes()) +
      pad2(date.getUTCSeconds()) +
      "Z"
    );
  };

  const byday = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"][weekday - 1];
  const recur = `RRULE:FREQ=WEEKLY;BYDAY=${byday}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details,
    dates: `${toGoogleDate(start)}/${toGoogleDate(end)}`,
    recur,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export type CheckInScheduleCardProps = {
  coupleName: string;
  enabled: boolean;
  weekday: number | null;
  time: string | null;
  durationMinutes: number | null;
  timeZone: string | null;
};

export function CheckInScheduleCard({
  coupleName,
  enabled,
  weekday,
  time,
  durationMinutes,
  timeZone,
}: CheckInScheduleCardProps) {
  const router = useRouter();

  const [isEnabled, setIsEnabled] = useState(enabled);
  const [selectedWeekday, setSelectedWeekday] = useState<number>(
    weekday ?? 6
  );
  const [selectedTime, setSelectedTime] = useState(time ?? "19:00");
  const [selectedDuration, setSelectedDuration] = useState(
    durationMinutes ?? 15
  );

  const detectedTimeZone = useMemo(() => {
    const tz =
      timeZone ||
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : null);
    return tz || "";
  }, [timeZone]);

  const saveAction = useAction(updateCheckInSchedule, {
    onSuccess: () => {
      toast.success("Check-in gespeichert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Konnte nicht speichern", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const handleSave = () => {
    saveAction.execute({
      enabled: isEnabled,
      weekday: isEnabled ? selectedWeekday : undefined,
      time: isEnabled ? selectedTime : undefined,
      durationMinutes: isEnabled ? selectedDuration : undefined,
      timeZone: isEnabled ? detectedTimeZone : undefined,
    });
  };

  const calendarTitle = `Weekly Check-in (${coupleName})`;
  const calendarDetails =
    "15 Minuten Struktur: Wertschaetzung, was war schwer, KR updaten, eine Sache fuer naechste Woche.";

  const googleUrl = isEnabled
    ? buildGoogleCalendarUrl({
        title: calendarTitle,
        details: calendarDetails,
        weekday: selectedWeekday,
        time: selectedTime,
        durationMinutes: selectedDuration,
      })
    : "";

  const handleDownloadIcs = () => {
    if (!isEnabled) return;

    const ics = buildIcs({
      title: calendarTitle,
      description: calendarDetails,
      weekday: selectedWeekday,
      time: selectedTime,
      durationMinutes: selectedDuration,
    });

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weekly-checkin.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-primary">
            Wochen-Check-in
          </p>
          <p className="text-sm text-muted-foreground">
            Tragt euren Check-in als wiederkehrenden Termin ein - das ist die beste
            Reminder-Logik fuer Smartphone.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />
          Aktiv
        </label>
      </div>

      {isEnabled ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="checkin-weekday">Wochentag</Label>
            <select
              id="checkin-weekday"
              value={selectedWeekday}
              onChange={(event) => setSelectedWeekday(Number(event.target.value))}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {weekdays.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkin-time">Uhrzeit</Label>
            <Input
              id="checkin-time"
              type="time"
              value={selectedTime}
              onChange={(event) => setSelectedTime(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkin-duration">Dauer</Label>
            <select
              id="checkin-duration"
              value={selectedDuration}
              onChange={(event) =>
                setSelectedDuration(Number(event.target.value))
              }
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {[10, 15, 20, 30, 45].map((value) => (
                <option key={value} value={value}>
                  {value} Minuten
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="rounded-2xl"
          onClick={handleSave}
          disabled={saveAction.isPending}
        >
          Speichern
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={() => window.open(googleUrl, "_blank")}
          disabled={!isEnabled}
        >
          Zu Google Calendar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={handleDownloadIcs}
          disabled={!isEnabled}
        >
          .ics herunterladen
        </Button>
      </div>

      {detectedTimeZone ? (
        <p className="text-xs text-muted-foreground">Zeitzone: {detectedTimeZone}</p>
      ) : null}
    </div>
  );
}
