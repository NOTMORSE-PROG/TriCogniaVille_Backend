"use client";

import { getLevelInfo } from "@/lib/gamification/levels";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface XpProgressProps {
  xp: number;
  className?: string;
}

export function XpProgress({ xp, className }: XpProgressProps) {
  const { level, progressXp, progressPct, nextLevelXp, currentLevelXp } = getLevelInfo(xp);
  const rangeXp = nextLevelXp - currentLevelXp;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Level circle */}
      <div className="flex-none flex items-center justify-center size-14 rounded-full bg-primary text-primary-foreground font-bold text-xl select-none ring-2 ring-primary/20 shrink-0">
        {level}
      </div>

      {/* XP progress bar — Progress auto-renders ProgressTrack + ProgressIndicator internally */}
      <div className="flex-1 min-w-0">
        <Progress value={progressPct}>
          <ProgressLabel>Level {level}</ProgressLabel>
          <ProgressValue>
            {xp.toLocaleString()} XP total &middot;{" "}
            {progressXp.toLocaleString()} / {rangeXp.toLocaleString()} to Level{" "}
            {level + 1}
          </ProgressValue>
        </Progress>
      </div>
    </div>
  );
}
