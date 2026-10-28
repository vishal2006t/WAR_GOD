import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "emerald" | "blue" | "amber" | "rose" | "purple";
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "emerald",
  badge,
}) => {
  const colorMap = {
    emerald: {
      border: "border-emerald-500/20 hover:border-emerald-500/40",
      iconBg: "bg-emerald-500/10 text-emerald-400",
      glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    },
    blue: {
      border: "border-blue-500/20 hover:border-blue-500/40",
      iconBg: "bg-blue-500/10 text-blue-400",
      glow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]",
    },
    amber: {
      border: "border-amber-500/20 hover:border-amber-500/40",
      iconBg: "bg-amber-500/10 text-amber-400",
      glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    },
    rose: {
      border: "border-rose-500/20 hover:border-rose-500/40",
      iconBg: "bg-rose-500/10 text-rose-400",
      glow: "hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]",
    },
    purple: {
      border: "border-purple-500/20 hover:border-purple-500/40",
      iconBg: "bg-purple-500/10 text-purple-400",
      glow: "hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]",
    },
  };

  const scheme = colorMap[color];

  return (
    <div
      className={`relative glass-card rounded-xl p-5 border transition-all duration-300 ${scheme.border} ${scheme.glow}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</h3>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${scheme.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {badge && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>{badge}</span>
        </div>
      )}
    </div>
  );
};
