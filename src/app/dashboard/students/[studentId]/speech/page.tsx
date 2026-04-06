"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SpeechAssessment {
  id: number;
  questId: string;
  buildingId: string;
  stage: string;
  expectedText: string;
  transcript: string | null;
  confidence: number | null;
  score: number | null;
  feedback: string | null;
  errorTypes: string | null; // JSON array string
  audioUrl: string | null;
  flagReview: boolean;
  attemptNumber: number;
  teacherNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge variant="outline">Unscored</Badge>;
  if (score >= 75) return <Badge className="bg-green-600 text-white">{score}%</Badge>;
  if (score >= 50) return <Badge className="bg-yellow-500 text-white">{score}%</Badge>;
  return <Badge variant="destructive">{score}%</Badge>;
}

function ErrorTypePills({ errorTypesJson }: { errorTypesJson: string | null }) {
  if (!errorTypesJson) return null;
  let types: string[] = [];
  try {
    types = JSON.parse(errorTypesJson);
  } catch {
    return null;
  }
  if (types.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {types.map((t) => (
        <span
          key={t}
          className="text-xs bg-muted border rounded-full px-2 py-0.5 capitalize"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function ReviewForm({
  assessment,
  onSaved,
}: {
  assessment: SpeechAssessment;
  onSaved: (updated: SpeechAssessment) => void;
}) {
  const [note, setNote] = useState(assessment.teacherNote ?? "");
  const [scoreOverride, setScoreOverride] = useState<string>(
    assessment.score !== null ? String(assessment.score) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      flagReview: false,
      teacherNote: note.trim() || undefined,
    };
    const overrideNum = parseInt(scoreOverride, 10);
    if (!isNaN(overrideNum) && overrideNum !== assessment.score) {
      body.scoreOverride = overrideNum;
    }
    try {
      const res = await fetch(`/api/v1/speech/review/${assessment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save review");
      const { assessment: updated } = await res.json();
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 p-3 bg-muted/40 border rounded-lg space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Teacher Note
        </label>
        <textarea
          className="w-full text-sm border rounded p-2 bg-background resize-none"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Leave a note for the student..."
        />
      </div>
      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Override Score (0–100)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            className="w-24 text-sm border rounded p-2 bg-background"
            value={scoreOverride}
            onChange={(e) => setScoreOverride(e.target.value)}
          />
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Mark Reviewed"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function StudentSpeechPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [assessments, setAssessments] = useState<SpeechAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/dashboard/students/${studentId}/speech`)
      .then((res) => res.json())
      .then((data) => setAssessments(data.assessments ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [studentId]);

  function handleReviewSaved(updated: SpeechAssessment) {
    setAssessments((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
    setExpandedId(null);
  }

  if (loading) return <div className="text-muted-foreground">Loading speech readings...</div>;

  const flagged = assessments.filter((a) => a.flagReview && !a.reviewedBy);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{assessments.length}</p>
            <p className="text-xs text-muted-foreground">Total Readings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-destructive">{flagged.length}</p>
            <p className="text-xs text-muted-foreground">Needs Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">
              {assessments.filter((a) => (a.score ?? 0) >= 75).length}
            </p>
            <p className="text-xs text-muted-foreground">Passed (≥75%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">
              {assessments.length > 0
                ? Math.round(
                    assessments.reduce((s, a) => s + (a.score ?? 0), 0) /
                      assessments.length
                  )
                : "—"}
              {assessments.length > 0 ? "%" : ""}
            </p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Readings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Speech Readings ({assessments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">
              No speech readings recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Quest / Stage</TableHead>
                  <TableHead>Expected Text</TableHead>
                  <TableHead>What They Said</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a) => (
                  <>
                    <TableRow
                      key={a.id}
                      className={
                        a.flagReview && !a.reviewedBy
                          ? "bg-yellow-500/10 border-yellow-500/30"
                          : ""
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="capitalize font-medium">
                          {a.buildingId.replace("_", " ")}
                        </span>
                        <br />
                        <span className="text-muted-foreground capitalize">{a.stage}</span>
                        {a.attemptNumber > 1 && (
                          <span className="text-muted-foreground"> · Attempt {a.attemptNumber}</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <span className="text-sm font-medium text-amber-400">
                          {a.expectedText}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <span className="text-sm text-muted-foreground italic">
                          {a.transcript ?? "(not captured)"}
                        </span>
                        {a.confidence !== null && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Confidence: {Math.round((a.confidence ?? 0) * 100)}%
                          </div>
                        )}
                        {a.audioUrl && (
                          <div className="mt-1.5">
                            <audio controls src={a.audioUrl} className="w-full h-8" preload="none" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ScoreBadge score={a.score} />
                      </TableCell>
                      <TableCell>
                        <ErrorTypePills errorTypesJson={a.errorTypes} />
                      </TableCell>
                      <TableCell>
                        {a.reviewedBy ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Reviewed
                          </Badge>
                        ) : a.flagReview ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-yellow-600 border-yellow-600 text-xs"
                            onClick={() =>
                              setExpandedId(expandedId === a.id ? null : a.id)
                            }
                          >
                            {expandedId === a.id ? "Close" : "Review"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedId === a.id && (
                      <TableRow key={`${a.id}-review`}>
                        <TableCell colSpan={7} className="bg-muted/20 pb-4">
                          <div className="px-2">
                            {a.feedback && (
                              <p className="text-sm text-muted-foreground mb-2">
                                <span className="font-medium">Auto feedback: </span>
                                {a.feedback}
                              </p>
                            )}
                            <ReviewForm assessment={a} onSaved={handleReviewSaved} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
