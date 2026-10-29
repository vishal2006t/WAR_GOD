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
      border: "hover:border-[#075B46]/40",
      iconBg: "bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB]",
    },
    blue: {
      border: "hover:border-[#087F5B]/40",
      iconBg: "bg-[#EDF7EF] text-[#087F5B] border border-[#D7E5DB]",
    },
    amber: {
      border: "hover:border-amber-400/50",
      iconBg: "bg-amber-50 text-amber-700 border border-amber-200",
    },
    rose: {
      border: "hover:border-rose-400/50",
      iconBg: "bg-rose-50 text-rose-700 border border-rose-200",
    },
    purple: {
      border: "hover:border-[#075B46]/40",
      iconBg: "bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB]",
    },
  };

  const scheme = colorMap[color];

  return (
    <div
      className={`relative bg-white rounded-2xl p-5 border border-[#D7E5DB] shadow-sm hover:shadow-md transition-all duration-300 ${scheme.border}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[#6B7C74] uppercase tracking-wider">{title}</p>
          <h3 className="mt-2 text-2xl sm:text-3xl font-serif text-[#173C32] tracking-tight">{value}</h3>
          {subtitle && <p className="mt-1 text-xs text-[#6B7C74]">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl shadow-sm ${scheme.iconBg}`}>
          <Icon className="w-5 h-5 stroke-[2]" />
        </div>
      </div>
      {badge && (
        <div className="mt-3 pt-3 border-t border-[#D7E5DB] flex items-center justify-between text-xs text-[#6B7C74]">
          <span>{badge}</span>
        </div>
      )}
    </div>
  );
};
