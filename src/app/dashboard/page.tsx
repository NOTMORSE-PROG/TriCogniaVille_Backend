"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AnalyticsData {
  totalStudents: number;
  activeToday: number;
  readingLevelDistribution: { level: number; count: number }[];
  streakLeaderboard: { id: string; name: string; streakDays: number; xp: number }[];
  recentActivity: {
    questId: string;
    buildingId: string;
    passed: boolean;
    studentName: string;
    completedAt: string | null;
  }[];
}

export default function DashboardOverview() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/analytics")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="text-destructive">Failed to load dashboard data.</div>;
  }

  const avgLevel =
    data.readingLevelDistribution.length > 0
      ? (
          data.readingLevelDistribution.reduce(
            (sum, d) => sum + d.level * d.count,
            0
          ) / data.totalStudents
        ).toFixed(1)
      : "N/A";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Overview</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.activeToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg Reading Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgLevel}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Top Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.streakLeaderboard[0]?.streakDays || 0} days
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
            <p className="text-muted-foreground">No student data yet.</p>
          ) : (
            <div className="space-y-3">
              {data.readingLevelDistribution.map((d) => (
                <div key={d.level} className="flex items-center gap-3">
                  <span className="w-24 text-sm">Level {d.level}</span>
                  <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{
                        width: `${data.totalStudents > 0 ? (d.count / data.totalStudents) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Streak Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Streak Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {data.streakLeaderboard.length === 0 ? (
              <p className="text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {data.streakLeaderboard.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/dashboard/students/${s.id}`}
                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm w-6">
                        #{i + 1}
                      </span>
                      <span className="font-medium">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{s.streakDays}d streak</Badge>
                      <Badge variant="outline">{s.xp} XP</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {data.recentActivity.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded border"
                  >
                    <div>
                      <span className="font-medium">{a.studentName}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {a.buildingId} / {a.questId}
                      </span>
                    </div>
                    <Badge variant={a.passed ? "default" : "destructive"}>
                      {a.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
