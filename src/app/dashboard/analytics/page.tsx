"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AnalyticsData {
  totalStudents: number;
  activeToday: number;
  readingLevelDistribution: { level: number; count: number }[];
  questPassRate: {
    buildingId: string;
    total: number;
    passed: number;
    rate: number;
  }[];
  streakLeaderboard: {
    id: string;
    name: string;
    streakDays: number;
    xp: number;
  }[];
  recentActivity: {
    questId: string;
    buildingId: string;
    passed: boolean;
    studentName: string;
    completedAt: string | null;
  }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/analytics")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "Not authenticated" : `API error ${res.status}`);
        return res.json();
      })
      .then((json) =>
        setData({
          ...json,
          readingLevelDistribution: json.readingLevelDistribution ?? [],
          questPassRate: json.questPassRate ?? [],
          streakLeaderboard: json.streakLeaderboard ?? [],
          recentActivity: json.recentActivity ?? [],
        })
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-muted-foreground">Loading analytics...</div>;
  if (error) return <div className="text-destructive">Error: {error}</div>;
  if (!data) return <div className="text-destructive">Failed to load analytics.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Active Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.activeToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Reading Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.readingLevelDistribution.length} levels
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reading Level Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Reading Level Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {data.readingLevelDistribution.length === 0 ? (
            <p className="text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((level) => {
                const item = data.readingLevelDistribution.find(
                  (d) => d.level === level
                );
                const count = item?.count || 0;
                const pct =
                  data.totalStudents > 0
                    ? Math.round((count / data.totalStudents) * 100)
                    : 0;
                const labels = [
                  "Non-Reader",
                  "Emerging",
                  "Developing",
                  "Independent",
                ];
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className="w-32 text-sm">
                      L{level}: {labels[level - 1]}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full flex items-center pl-3 text-primary-foreground text-xs font-medium transition-all"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      >
                        {pct}%
                      </div>
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quest Pass Rate by Building */}
      <Card>
        <CardHeader>
          <CardTitle>Quest Pass Rate by Building</CardTitle>
        </CardHeader>
        <CardContent>
          {data.questPassRate.length === 0 ? (
            <p className="text-muted-foreground">No quest data yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.questPassRate.map((q) => (
                <div
                  key={q.buildingId}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="font-medium capitalize">
                    {q.buildingId.replace("_", " ")}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {q.passed}/{q.total} passed
                    </span>
                    <Badge
                      variant={q.rate >= 70 ? "default" : "destructive"}
                    >
                      {q.rate}%
                    </Badge>
                  </div>
                  <div className="bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        q.rate >= 70 ? "bg-primary" : "bg-destructive"
                      }`}
                      style={{ width: `${q.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* XP Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Top Students by Streak</CardTitle>
        </CardHeader>
        <CardContent>
          {data.streakLeaderboard.length === 0 ? (
            <p className="text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.streakLeaderboard.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 px-3 rounded border"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-6 font-bold">
                      #{i + 1}
                    </span>
                    <span className="font-medium">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{s.streakDays}d</Badge>
                    <Badge variant="outline">{s.xp} XP</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
