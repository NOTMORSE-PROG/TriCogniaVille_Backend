"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ClassItem {
  id: string;
  name: string;
  inviteCode: string;
  studentCount: number;
  createdAt: string;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function loadClasses() {
    try {
      const res = await fetch("/api/dashboard/classes");
      const data = await res.json();
      setClasses(data.classes || []);
    } catch (error) {
      console.error("Failed to load classes:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/dashboard/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClassName.trim() }),
      });

      if (res.ok) {
        setNewClassName("");
        setDialogOpen(false);
        loadClasses();
      }
    } catch (error) {
      console.error("Failed to create class:", error);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading classes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Classes</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            Create Class
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="className" className="text-sm font-medium">
                  Class Name
                </label>
                <Input
                  id="className"
                  placeholder="e.g., Grade 7A - 2026"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? "Creating..." : "Create Class"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No classes yet. Create your first class to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Link key={cls.id} href={`/dashboard/classes/${cls.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{cls.name}</span>
                    <Badge variant="secondary">{cls.studentCount} students</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Invite Code:{" "}
                    <code className="bg-muted px-2 py-1 rounded font-mono">
                      {cls.inviteCode}
                    </code>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
