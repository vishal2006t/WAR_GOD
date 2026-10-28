import React from "react";

interface BadgeProps {
  status: string;
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({ status, size = "md" }) => {
  const normalized = status.toUpperCase().replace(/\s+/g, "_");

  const styleMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    REGISTERED: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/30",
      dot: "bg-blue-400",
    },
    ASSIGNED: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-400",
      border: "border-indigo-500/30",
      dot: "bg-indigo-400",
    },
    PICKED_UP: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
      dot: "bg-amber-400",
    },
    IN_TRANSIT: {
      bg: "bg-cyan-500/10",
      text: "text-cyan-400",
      border: "border-cyan-500/30",
      dot: "bg-cyan-400 animate-pulse",
    },
    DELIVERED: {
      bg: "bg-teal-500/10",
      text: "text-teal-400",
      border: "border-teal-500/30",
      dot: "bg-teal-400",
    },
    RECEIVED: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      dot: "bg-emerald-400",
    },
    PROCESSED: {
      bg: "bg-emerald-500/20",
      text: "text-emerald-300",
      border: "border-emerald-500/40",
      dot: "bg-emerald-300",
    },
    DISPUTED: {
      bg: "bg-rose-500/15",
      text: "text-rose-400",
      border: "border-rose-500/40",
      dot: "bg-rose-400 animate-ping",
    },
    VERIFIED: {
      bg: "bg-emerald-500/20",
      text: "text-emerald-400",
      border: "border-emerald-500/50",
      dot: "bg-emerald-400",
    },
    CONFIRMED: {
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      dot: "bg-emerald-400",
    },
    PENDING: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
      dot: "bg-amber-400",
    },
  };

  const style = styleMap[normalized] || {
    bg: "bg-slate-700/30",
    text: "text-slate-300",
    border: "border-slate-600/40",
    dot: "bg-slate-400",
  };

  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-medium";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
      {status.replace(/_/g, " ")}
    </span>
  );
};
