"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { XpProgress } from "@/components/gamification/xp-progress";
import { BadgeGrid } from "@/components/gamification/badge-grid";

const BUILDINGS = [
  "town_hall",
  "school",
  "library",
  "well",
  "market",
  "bakery",
];

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

interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressXp: number;
  progressPct: number;
}

interface StudentData {
  student: {
    id: string;
    name: string;
    email: string;
    readingLevel: number;
    xp: number;
    streakDays: number;
    lastActive: string | null;
    onboardingDone: boolean;
    createdAt: string;
  };
  questAttempts: {
    id: number;
    questId: string;
    buildingId: string;
    passed: boolean;
    attempts: number;
    completedAt: string | null;
  }[];
  buildingStates: {
    buildingId: string;
    unlocked: boolean;
    unlockedAt: string | null;
  }[];
  badges: BadgeItem[];
  level: LevelInfo;
}

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard/students/${studentId}`)
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div className="text-muted-foreground">Loading student...</div>;
  if (!data) return <div className="text-destructive">Failed to load student.</div>;

  const { student, questAttempts, buildingStates } = data;
  const buildingMap = new Map(buildingStates.map((b) => [b.buildingId, b]));

  return (
    <div className="space-y-6">
      {/* Tab nav */}
      <div className="flex gap-2 border-b pb-2">
        <span className="text-sm font-semibold border-b-2 border-primary pb-1 pr-2">
          Overview
        </span>
        <a
          href={`/dashboard/students/${student.id}/speech`}
          className="text-sm text-muted-foreground hover:text-foreground px-2 pb-1"
        >
          Speech Readings
        </a>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="text-2xl">{student.name}</span>
            <Badge variant="outline">Level {student.readingLevel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium">{student.email}</p>
            </div>
            <div>
              <span className="text-muted-foreground">XP</span>
              <p className="font-medium">{student.xp.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Streak</span>
              <p className="font-medium">{student.streakDays} days</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Active</span>
              <p className="font-medium">
                {student.lastActive
                  ? new Date(student.lastActive).toLocaleDateString()
                  : "Never"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* XP & Level */}
      <Card>
        <CardHeader>
          <CardTitle>XP &amp; Level</CardTitle>
        </CardHeader>
        <CardContent>
          <XpProgress xp={student.xp} />
        </CardContent>
      </Card>

      {/* Badge Collection */}
      <Card>
        <CardHeader>
          <CardTitle>
            Badges{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({data.badges.filter((b) => b.earned).length} /{" "}
              {data.badges.length} earned)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BadgeGrid badges={data.badges} />
        </CardContent>
      </Card>

      {/* Building Progress Grid */}
      <Card>
        <CardHeader>
          <CardTitle>
            Building Progress ({buildingStates.filter((b) => b.unlocked).length}/
            {BUILDINGS.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {BUILDINGS.map((buildingId) => {
              const state = buildingMap.get(buildingId);
              const unlocked = state?.unlocked || false;
              return (
                <div
                  key={buildingId}
                  className={`border rounded-lg p-4 text-center transition-colors ${
                    unlocked
                      ? "bg-primary/10 border-primary"
                      : "bg-muted/50 border-muted"
                  }`}
                >
                  <div className="text-2xl mb-1">{unlocked ? "🏠" : "🔒"}</div>
                  <div className="text-xs font-medium capitalize">
                    {buildingId.replace("_", " ")}
                  </div>
                  {state?.unlockedAt && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(state.unlockedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quest History */}
      <Card>
        <CardHeader>
          <CardTitle>Quest History ({questAttempts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {questAttempts.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">
              No quest attempts yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quest</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questAttempts.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.questId}</TableCell>
                    <TableCell className="capitalize">
                      {q.buildingId.replace("_", " ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={q.passed ? "default" : "destructive"}>
                        {q.passed ? "Passed" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell>{q.attempts}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {q.completedAt
                        ? new Date(q.completedAt).toLocaleString()
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
