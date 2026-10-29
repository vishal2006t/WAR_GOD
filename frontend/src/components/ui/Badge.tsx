import React from "react";

interface BadgeProps {
  status?: string;
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "warning" | "outline" | string;
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  children,
  variant,
  size = "md",
  className = "",
}) => {
  const content = children || status || "";
  const textString = typeof content === "string" ? content : status || "";
  const normalized = (status || (variant ? variant.toUpperCase() : textString))
    .toString()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const styleMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    REGISTERED: { bg: "bg-[#EDF7EF]", text: "text-[#075B46]", border: "border-[#D7E5DB]", dot: "bg-[#075B46]" },
    ASSIGNED: { bg: "bg-[#EDF7EF]", text: "text-[#173C32]", border: "border-[#D7E5DB]", dot: "bg-[#087F5B]" },
    PICKED_UP: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-600" },
    IN_TRANSIT: { bg: "bg-[#E5F5EA]", text: "text-[#075B46]", border: "border-[#D7E5DB]", dot: "bg-[#087F5B] animate-pulse" },
    ON_BREAK: { bg: "bg-amber-100", text: "text-amber-900 font-semibold", border: "border-amber-300", dot: "bg-amber-600 animate-pulse" },
    ARRIVED_AT_FACTORY: { bg: "bg-emerald-100", text: "text-emerald-950 font-semibold", border: "border-emerald-300", dot: "bg-emerald-600 animate-ping" },
    DELIVERED: { bg: "bg-[#E5F5EA]", text: "text-[#075B46]", border: "border-[#D7E5DB]", dot: "bg-[#075B46]" },
    RECEIVED: { bg: "bg-[#E5F5EA]", text: "text-[#075B46]", border: "border-[#D7E5DB]", dot: "bg-[#075B46]" },
    PROCESSED: { bg: "bg-[#E5F5EA]", text: "text-[#075B46]", border: "border-[#D7E5DB]", dot: "bg-[#075B46]" },
    DISPUTED: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500 animate-ping" },
    VERIFIED: { bg: "bg-[#E5F5EA]", text: "text-[#075B46]", border: "border-[#D7E5DB]", dot: "bg-[#075B46]" },
    CONFIRMED: { bg: "bg-[#E5F5EA]", text: "text-[#075B46]", border: "border-[#D7E5DB]", dot: "bg-[#075B46]" },
    PENDING: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-600" },
    PRIMARY: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-600" },
    SUCCESS: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-600" },
    DANGER: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-600" },
    WARNING: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-600" },
    SECONDARY: { bg: "bg-[#EDF7EF]", text: "text-[#173C32]", border: "border-[#D7E5DB]", dot: "bg-[#075B46]" },
    OUTLINE: { bg: "bg-white", text: "text-[#6B7C74]", border: "border-[#D7E5DB]", dot: "bg-[#6B7C74]" },
  };

  const style = styleMap[normalized] || {
    bg: "bg-[#EDF7EF]",
    text: "text-[#6B7C74]",
    border: "border-[#D7E5DB]",
    dot: "bg-[#6B7C74]",
  };

  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-medium";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
      {content || textString.replace(/_/g, " ")}
    </span>
  );
};
