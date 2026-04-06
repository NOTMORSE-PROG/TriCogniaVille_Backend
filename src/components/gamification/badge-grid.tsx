"use client";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BadgeItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  requirement: string;
  earned: boolean;
  earnedAt: string | null;
}

interface BadgeGridProps {
  badges: BadgeItem[];
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  building: "Buildings",
  streak: "Streaks",
  xp: "XP Milestones",
  quest: "Quests",
  level: "Reading Levels",
};

const CATEGORY_ORDER = ["building", "streak", "xp", "quest", "level"] as const;

export function BadgeGrid({ badges, className }: BadgeGridProps) {
  const grouped = Object.fromEntries(
    CATEGORY_ORDER.map((cat) => [cat, badges.filter((b) => b.category === cat)])
  );

  return (
    <TooltipProvider delay={200}>
      <div className={cn("space-y-5", className)}>
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {grouped[cat].map((badge) => (
                <Tooltip key={badge.id}>
                  <TooltipTrigger
                    render={
                      <div
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 cursor-default select-none transition-all duration-200",
                          badge.earned
                            ? "bg-primary/10 border-primary/30 hover:bg-primary/15 hover:border-primary/50"
                            : "bg-muted/30 border-muted/50 opacity-40 grayscale"
                        )}
                      />
                    }
                  >
                    <span className="text-xl leading-none">{badge.icon}</span>
                    <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">
                      {badge.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="text-center space-y-0.5">
                      <p className="font-semibold">{badge.name}</p>
                      <p className="text-xs opacity-80">{badge.requirement}</p>
                      {badge.earned && badge.earnedAt ? (
                        <p className="text-xs opacity-60">
                          Earned{" "}
                          {new Date(badge.earnedAt).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="text-xs opacity-60 italic">
                          Not yet earned
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
