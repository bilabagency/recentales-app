"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import { formatDateLong } from "@/lib/utils";

type DayPart = "full" | "morning" | "afternoon";

interface DaySelection {
  date: string;
  part: DayPart;
}

interface Guest {
  name: string;
  isVegetarian: boolean;
  days: DaySelection[];
}

interface AttendancePopupProps {
  open: boolean;
  onClose: () => void;
  eventName: string;
  days: string[];
  userName: string;
  initialDays?: DaySelection[];
  initialVegetarian?: boolean;
  onConfirm: (data: {
    myDays: DaySelection[];
    isVegetarian: boolean;
    guests: Guest[];
  }) => Promise<void>;
}

function Toggle({
  checked,
  onChange,
  size = "normal",
}: {
  checked: boolean;
  onChange: () => void;
  size?: "normal" | "large";
}) {
  const w = size === "large" ? "w-14 h-8" : "w-12 h-7";
  const dot =
    size === "large"
      ? "w-6 h-6 top-1"
      : "w-5 h-5 top-1";
  const translate = size === "large" ? "translate-x-[26px]" : "translate-x-[22px]";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`${w} rounded-full transition-colors relative shrink-0 ${
        checked ? "bg-emerald-500" : "bg-slate-600"
      }`}
    >
      <div
        className={`absolute ${dot} bg-white rounded-full shadow-md transition-transform ${
          checked ? translate : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function AttendancePopup({
  open,
  onClose,
  eventName,
  days,
  userName,
  initialDays,
  initialVegetarian,
  onConfirm,
}: AttendancePopupProps) {
  // Selected dates as a Set for quick lookup
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => {
    if (initialDays && initialDays.length > 0) {
      return new Set(initialDays.map((d) => d.date));
    }
    return new Set(days);
  });
  const [isVegetarian, setIsVegetarian] = useState(initialVegetarian || false);

  // Sync when popup opens with new initial data
  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) {
    if (initialDays && initialDays.length > 0) {
      setSelectedDays(new Set(initialDays.map((d) => d.date)));
    } else {
      setSelectedDays(new Set(days));
    }
    if (initialVegetarian !== undefined) setIsVegetarian(initialVegetarian);
  }
  if (open !== lastOpen) setLastOpen(open);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestVeg, setGuestVeg] = useState(false);
  const [saving, setSaving] = useState(false);

  // Expanding guest index for editing days
  const [expandedGuest, setExpandedGuest] = useState<number | null>(null);

  const toggleDay = (date: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const addGuest = () => {
    if (!guestName.trim()) return;
    const guestDays: DaySelection[] = Array.from(selectedDays).map((d) => ({
      date: d,
      part: "full" as DayPart,
    }));
    setGuests((prev) => [
      ...prev,
      { name: guestName.trim(), isVegetarian: guestVeg, days: guestDays },
    ]);
    setGuestName("");
    setGuestVeg(false);
    setShowAddGuest(false);
    setExpandedGuest(guests.length);
  };

  const removeGuest = (index: number) => {
    setGuests((prev) => prev.filter((_, i) => i !== index));
    if (expandedGuest === index) setExpandedGuest(null);
    else if (expandedGuest !== null && expandedGuest > index) {
      setExpandedGuest(expandedGuest - 1);
    }
  };

  const toggleGuestDay = (guestIndex: number, date: string) => {
    setGuests((prev) =>
      prev.map((g, i) => {
        if (i !== guestIndex) return g;
        const has = g.days.some((d) => d.date === date);
        if (has) {
          return { ...g, days: g.days.filter((d) => d.date !== date) };
        } else {
          return { ...g, days: [...g.days, { date, part: "full" as DayPart }] };
        }
      })
    );
  };

  const toggleGuestVegetarian = (index: number) => {
    setGuests((prev) =>
      prev.map((g, i) =>
        i === index ? { ...g, isVegetarian: !g.isVegetarian } : g
      )
    );
  };

  const handleConfirm = async () => {
    setSaving(true);
    const myDays: DaySelection[] = Array.from(selectedDays).map((d) => ({
      date: d,
      part: "full" as DayPart,
    }));
    await onConfirm({ myDays, isVegetarian, guests });
    setSaving(false);
  };

  const myDayCount = selectedDays.size;
  const guestCount = guests.length;

  return (
    <Modal open={open} onClose={onClose} title={eventName}>
      <div className="space-y-6">
        {/* Summary badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-emerald-300 text-sm font-semibold">
              {myDayCount === 0
                ? "No vas ningún día"
                : myDayCount === 1
                ? "Vas 1 día"
                : `Vas ${myDayCount} días`}
            </span>
          </div>
          {guestCount > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-amber-300 text-sm font-semibold">
                {guestCount === 1
                  ? "1 acompañante"
                  : `${guestCount} acompañantes`}
              </span>
            </div>
          )}
        </div>

        {/* My days — vertical list */}
        <div>
          <p className="text-base font-semibold text-slate-200 mb-4">
            {userName}, ¿qué días venís?
          </p>
          <div className="space-y-2">
            {days.map((day) => {
              const isOn = selectedDays.has(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-xl transition-colors ${
                    isOn
                      ? "bg-emerald-500/10 border border-emerald-500/25"
                      : "bg-slate-800/60 border border-slate-700/50"
                  }`}
                >
                  <span
                    className={`text-base font-medium ${
                      isOn ? "text-slate-100" : "text-slate-500"
                    }`}
                  >
                    {formatDateLong(day)}
                  </span>
                  <Toggle
                    checked={isOn}
                    onChange={() => toggleDay(day)}
                    size="large"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Vegetarian toggle */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <span className="text-slate-300 text-base">Soy vegetariano/a</span>
          <Toggle
            checked={isVegetarian}
            onChange={() => setIsVegetarian(!isVegetarian)}
          />
        </div>

        <div className="border-t border-slate-800" />

        {/* Guests section */}
        <div>
          <p className="text-base font-semibold text-slate-200 mb-4">
            ¿Traés a alguien?
          </p>

          {/* Guest list */}
          {guests.length > 0 && (
            <div className="space-y-3 mb-4">
              {guests.map((guest, index) => (
                <div
                  key={index}
                  className="bg-slate-800/80 border border-slate-700/50 rounded-xl overflow-hidden"
                >
                  {/* Guest header */}
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm uppercase">
                        {guest.name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-slate-100 font-medium text-base">
                          {guest.name}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {guest.days.length === 0
                            ? "No va ningún día"
                            : guest.days.length === 1
                            ? "Va 1 día"
                            : `Va ${guest.days.length} días`}
                          {guest.isVegetarian && " · Vegetariano/a"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGuest(
                            expandedGuest === index ? null : index
                          )
                        }
                        className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Editar días"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-5 w-5 transition-transform ${
                            expandedGuest === index ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGuest(index)}
                        className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded: guest days + vegetarian */}
                  {expandedGuest === index && (
                    <div className="px-4 pb-4 space-y-2 border-t border-slate-700/50 pt-3">
                      {/* Guest vegetarian toggle */}
                      <div className="flex items-center justify-between py-2 px-1">
                        <span className="text-slate-400 text-sm">
                          Vegetariano/a
                        </span>
                        <Toggle
                          checked={guest.isVegetarian}
                          onChange={() => toggleGuestVegetarian(index)}
                        />
                      </div>
                      {/* Guest days */}
                      {days.map((day) => {
                        const isOn = guest.days.some((d) => d.date === day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleGuestDay(index, day)}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors ${
                              isOn
                                ? "bg-emerald-500/10 border border-emerald-500/20"
                                : "bg-slate-700/40 border border-slate-600/30"
                            }`}
                          >
                            <span
                              className={`text-sm font-medium ${
                                isOn ? "text-slate-200" : "text-slate-500"
                              }`}
                            >
                              {formatDateLong(day)}
                            </span>
                            <Toggle
                              checked={isOn}
                              onChange={() => toggleGuestDay(index, day)}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add guest form */}
          {showAddGuest ? (
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-4 space-y-4">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nombre del acompañante"
                autoFocus
                className="w-full px-4 py-3.5 bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base"
              />
              <div className="flex items-center justify-between px-1">
                <span className="text-slate-400 text-sm">Vegetariano/a</span>
                <Toggle
                  checked={guestVeg}
                  onChange={() => setGuestVeg(!guestVeg)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddGuest(false);
                    setGuestName("");
                    setGuestVeg(false);
                  }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={addGuest}
                  disabled={!guestName.trim()}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  Agregar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddGuest(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-800/60 hover:bg-slate-800 border-2 border-dashed border-slate-600 hover:border-slate-500 text-slate-300 font-medium rounded-xl transition-colors text-base"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Agregar acompañante
            </button>
          )}
        </div>

        {/* Confirm button */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || selectedDays.size === 0}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl text-lg transition-colors shadow-lg shadow-emerald-600/20"
        >
          {saving ? "Guardando..." : "Confirmar asistencia"}
        </button>
      </div>
    </Modal>
  );
}
