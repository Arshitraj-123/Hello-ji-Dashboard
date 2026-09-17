import type { Status } from "@/types/booking";

export interface StatusColorInfo {
  hex: string;
  bg: string;
  text: string;
  border: string;
  label: string;
}

export const STATUS_COLORS: Record<string, StatusColorInfo> = {
  "New Query": {
    hex: "#475569",
    bg: "bg-slate-500/10",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/25",
    label: "New Query",
  },
  Pipeline: {
    hex: "#d97706",
    bg: "bg-amber-500/15",
    text: "text-amber-800 dark:text-amber-400",
    border: "border-amber-500/35",
    label: "Pipeline",
  },
  Confirmed: {
    hex: "#0d9488",
    bg: "bg-teal-500/10",
    text: "text-teal-700 dark:text-teal-400",
    border: "border-teal-500/25",
    label: "Confirmed",
  },
  confirmed: {
    hex: "#0d9488",
    bg: "bg-teal-500/10",
    text: "text-teal-700 dark:text-teal-400",
    border: "border-teal-500/25",
    label: "Confirmed",
  },
  booked: {
    hex: "#c0392b",
    bg: "bg-[#c0392b]/10",
    text: "text-[#c0392b] dark:text-[#e74c3c]",
    border: "border-[#c0392b]/25",
    label: "Booked",
  },
  Abort: {
    hex: "#94a3b8",
    bg: "bg-slate-400/10",
    text: "text-slate-500 dark:text-slate-400",
    border: "border-slate-400/25",
    label: "Aborted",
  },
};

export function getStatusColor(status?: string | null): StatusColorInfo {
  if (!status) {
    return {
      hex: "#94a3b8",
      bg: "bg-muted",
      text: "text-muted-foreground",
      border: "border-border",
      label: "Unknown",
    };
  }
  const key = status.trim();
  if (STATUS_COLORS[key]) {
    return STATUS_COLORS[key];
  }
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(STATUS_COLORS)) {
    if (k.toLowerCase() === lower) return v;
  }
  return {
    hex: "#94a3b8",
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    label: status,
  };
}

export const statusTone: Record<Status, string> = {
  "New Query": "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25",
  Pipeline: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/35",
  Confirmed: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25",
  confirmed: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25",
  booked: "bg-[#c0392b]/10 text-[#c0392b] dark:text-[#e74c3c] border-[#c0392b]/25",
  Abort: "bg-slate-400/10 text-slate-500 dark:text-slate-400 border-slate-400/25",
};
