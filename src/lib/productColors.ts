export interface ProductColorInfo {
  hex: string;
  bg: string;
  text: string;
  border: string;
  label: string;
}

export const PRODUCT_COLORS: Record<string, ProductColorInfo> = {
  hotel: {
    hex: "#2563eb", // blue-600
    bg: "bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
    label: "Hotel",
  },
  package: {
    hex: "#7c3aed", // violet-600
    bg: "bg-violet-500/15",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-500/30",
    label: "Package",
  },
  ticket: {
    hex: "#ea580c", // orange-600
    bg: "bg-orange-500/15",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30",
    label: "Ticket / Flight",
  },
  visa: {
    hex: "#0891b2", // cyan-600
    bg: "bg-cyan-500/15",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-500/30",
    label: "Visa",
  },
  insurance: {
    hex: "#16a34a", // emerald/green-600
    bg: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    label: "Insurance",
  },
  other: {
    hex: "#6b7280", // gray-500
    bg: "bg-gray-500/15",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-500/30",
    label: "Other",
  },
  Other: {
    hex: "#6b7280", // gray-500
    bg: "bg-gray-500/15",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-500/30",
    label: "Other",
  },
};

export function getProductColor(product?: string | null): ProductColorInfo {
  if (!product) return PRODUCT_COLORS.other;
  const key = product.toLowerCase().trim();
  return PRODUCT_COLORS[key] || PRODUCT_COLORS.other;
}
