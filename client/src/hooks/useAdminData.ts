/**
 * Custom hooks for fetching admin data from the real API.
 * Replaces mockData.ts imports in admin pages.
 */
import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

/* ── Types matching the API responses ─── */

export interface MinistryMemberAPI {
  id: string;
  memberId: string;
  ministryId: string;
  isLeader: boolean;
  roles: string[];
  member: MemberAPI;
  ministry?: MinistryAPI;
}

export interface MemberAPI {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  instruments: string[];
  birthDate?: string | null;
  points: number;
  ministryMembers?: MinistryMemberAPI[];
}

export interface MinistryAPI {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  roles: { id: string; name: string }[];
  members: MinistryMemberAPI[];
}

export interface EventAPI {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  isRecurrent: boolean;
  recurrence?: string | null;
  scheduleItems?: ScheduleItemAPI[];
}

export interface ScheduleItemAPI {
  id: string;
  status: string;
  roleName: string;
  eventId: string;
  memberId: string;
  member: { id: string; name: string; photoUrl?: string | null; phone?: string | null };
  checkin?: { id: string; checkedInAt: string } | null;
}

export interface SongAPI {
  id: string;
  title: string;
  artist?: string | null;
  originalKey?: string | null;
  bpm?: number | null;
  structure?: string | null;
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
  cifraClubUrl?: string | null;
  lyrics?: string | null;
  chords?: string | null;
}

export interface SetlistItemAPI {
  id: string;
  order: number;
  songKey?: string | null;
  notes?: string | null;
  songId: string;
  eventId: string;
  song: SongAPI;
}

export interface ChatMessageAPI {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  eventId: string;
}

/* ── Generic fetch hook ─── */

export function useApiData<T>(path: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    api<T>(path)
      .then(setData)
      .catch((e) => setError(e.message ?? "Erro ao carregar dados"))
      .finally(() => setLoading(false));
  }, [path, ...deps]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}

/* ── Specific hooks ─── */

export function useMembers() {
  return useApiData<MemberAPI[]>("/members");
}

export function useMinistries() {
  return useApiData<MinistryAPI[]>("/ministries");
}

export function useEvents(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return useApiData<EventAPI[]>(`/events${qs ? `?${qs}` : ""}`);
}

export function useSongs(query?: string) {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  return useApiData<SongAPI[]>(`/songs${qs}`, [query]);
}

export function useEventSchedule(eventId: string) {
  return useApiData<ScheduleItemAPI[]>(`/events/${eventId}/schedule`, [eventId]);
}

export function useEventSetlist(eventId: string) {
  return useApiData<SetlistItemAPI[]>(`/events/${eventId}/setlist`, [eventId]);
}

export function useEventChat(eventId: string) {
  return useApiData<ChatMessageAPI[]>(`/events/${eventId}/chat`, [eventId]);
}

/* ── Helpers ─── */

export const EVENT_TYPE_LABELS: Record<string, string> = {
  SUNDAY_MORNING: "Culto Domingo Manhã",
  SUNDAY_EVENING: "Culto Domingo Noite",
  WEDNESDAY_PRAYER: "Culto de Oração",
  REHEARSAL: "Ensaio",
  SPECIAL_EVENT: "Evento Especial",
};

export const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  SUNDAY_MORNING: { bg: "#ede9fe", text: "#7c3aed" },
  SUNDAY_EVENING: { bg: "#ede9fe", text: "#7c3aed" },
  WEDNESDAY_PRAYER: { bg: "#d1fae5", text: "#059669" },
  REHEARSAL: { bg: "#dbeafe", text: "#2563eb" },
  SPECIAL_EVENT: { bg: "#fce7f3", text: "#db2777" },
};

export function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export function getMinistryColor(ministryName: string): string {
  const colors: Record<string, string> = {
    Louvor: "#7c3aed",
    Mídia: "#2563eb",
    Recepção: "#db2777",
    Infantil: "#d97706",
    Jovens: "#059669",
    Intercessão: "#4338ca",
    Diaconato: "#4b5563",
  };
  return colors[ministryName] || "#7c3aed";
}

export function getMinistryBgColor(ministryName: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    Louvor: { bg: "#ede9fe", text: "#7c3aed" },
    Mídia: { bg: "#dbeafe", text: "#2563eb" },
    Recepção: { bg: "#fce7f3", text: "#db2777" },
    Infantil: { bg: "#fef3c7", text: "#d97706" },
    Jovens: { bg: "#d1fae5", text: "#059669" },
    Intercessão: { bg: "#e0e7ff", text: "#4338ca" },
    Diaconato: { bg: "#f3f4f6", text: "#4b5563" },
  };
  return colors[ministryName] || { bg: "#f5f3ff", text: "#7c3aed" };
}
