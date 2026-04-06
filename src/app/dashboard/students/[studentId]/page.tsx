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

const BUILDINGS = [
  "town_hall",
  "school",
  "library",
  "well",
  "market",
  "bakery",
];

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
              <p className="font-medium">{student.xp}</p>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
