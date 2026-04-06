"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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

interface Student {
  id: string;
  name: string;
  email: string;
  readingLevel: number;
  xp: number;
  streakDays: number;
  lastActive: string | null;
  onboardingDone: boolean;
}

interface ClassDetail {
  class: { id: string; name: string; inviteCode: string };
  students: Student[];
  stats: {
    totalStudents: number;
    totalQuests: number;
    passedQuests: number;
    passRate: number;
    totalBuildingsUnlocked: number;
    avgReadingLevel: number;
  };
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const [data, setData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard/classes/${classId}`)
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [classId]);

  if (loading) return <div className="text-muted-foreground">Loading class...</div>;
  if (!data) return <div className="text-destructive">Failed to load class.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{data.class.name}</h1>
        <p className="text-muted-foreground">
          Invite Code:{" "}
          <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
            {data.class.inviteCode}
          </code>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.avgReadingLevel}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Quest Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.passRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Buildings Unlocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalBuildingsUnlocked}</div>
          </CardContent>
        </Card>
      </div>

      {/* Student Roster */}
      <Card>
        <CardHeader>
          <CardTitle>Student Roster</CardTitle>
        </CardHeader>
        <CardContent>
          {data.students.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">
              No students enrolled yet. Share the invite code with students.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>XP</TableHead>
                  <TableHead>Streak</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/students/${student.id}`}
                        className="font-medium hover:underline"
                      >
                        {student.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {student.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Level {student.readingLevel}</Badge>
                    </TableCell>
                    <TableCell>{student.xp}</TableCell>
                    <TableCell>{student.streakDays}d</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {student.lastActive
                        ? new Date(student.lastActive).toLocaleDateString()
                        : "Never"}
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
