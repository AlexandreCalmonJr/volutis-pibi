export const MINISTERIO_COLORS: Record<string, { bg: string; text: string }> = {
  Louvor: { bg: "#ede9fe", text: "#7c3aed" },
  Mídia: { bg: "#dbeafe", text: "#2563eb" },
  Recepção: { bg: "#fce7f3", text: "#db2777" },
  Infantil: { bg: "#fef3c7", text: "#d97706" },
  Jovens: { bg: "#d1fae5", text: "#059669" },
  Intercessão: { bg: "#e0e7ff", text: "#4338ca" },
  Diaconato: { bg: "#f3f4f6", text: "#4b5563" },
  Staff: { bg: "#f1f5f9", text: "#64748b" },
  Transmissão: { bg: "#fee2e2", text: "#ef4444" },
};

export const MINISTERIOS = [
  "Louvor",
  "Mídia",
  "Recepção",
  "Infantil",
  "Jovens",
  "Intercessão",
  "Diaconato",
  "Staff",
  "Transmissão",
];

export function getMinistryColor(ministryName: string): { bg: string; text: string } {
  return MINISTERIO_COLORS[ministryName] || { bg: "#f5f3ff", text: "#7c3aed" };
}

export function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}
