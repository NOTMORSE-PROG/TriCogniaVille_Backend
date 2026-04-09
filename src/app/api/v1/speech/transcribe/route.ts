import Groq, { toFile } from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { withStudentAuth } from "@/lib/auth/middleware";
import { internalError } from "@/lib/api/errors";
import { uploadAudioToCloudinary } from "@/lib/cloudinary/upload-audio";

export const maxDuration = 60;

// Known Whisper hallucination phrases on silence/noise
const HALLUCINATIONS = new Set([
  "thank you",
  "thanks for watching",
  "subscribe",
  "like and subscribe",
  "thank you for watching",
  "you",
  "the end",
  "bye",
]);

const GROQ_KEYS = [process.env.GROQ_API_KEY!, process.env.GROQ_API_KEY_2!].filter(Boolean);

interface WhisperSegment {
  avg_logprob: number;
  no_speech_prob: number;
  text: string;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest) => {
    try {
      const body = await req.json();
      const audio: string | undefined = body.audio;
      const language: string = body.language ?? "en";

      if (!audio || typeof audio !== "string" || audio.length < 100) {
        return NextResponse.json(
          { error: "Missing or invalid audio data" },
          { status: 400 }
        );
      }

      // ISO 639-1: "en-US" → "en"
      const lang = language.includes("-") ? language.split("-")[0] : language;
      const buffer = Buffer.from(audio, "base64");

      // Transcribe with dual-key fallback (key 1 → key 2 on 429)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let transcription: any;
      for (let i = 0; i < GROQ_KEYS.length; i++) {
        try {
          const client = new Groq({ apiKey: GROQ_KEYS[i] });
          const file = await toFile(buffer, "speech.m4a", {
            type: "audio/mp4",
          });
          transcription = await client.audio.transcriptions.create({
            file,
            model: "whisper-large-v3-turbo",
            language: lang,
            response_format: "verbose_json",
            temperature: 0,
            timestamp_granularities: ["word", "segment"],
          });
          break;
        } catch (err: unknown) {
          const status = (err as { status?: number })?.status;
          if (status === 429 && i < GROQ_KEYS.length - 1) continue;
          throw err;
        }
      }

      // Confidence from segment avg_logprob
      const segments: WhisperSegment[] = transcription.segments ?? [];
      const avgLogprob =
        segments.length > 0
          ? segments.reduce(
              (s: number, seg: WhisperSegment) => s + seg.avg_logprob,
              0
            ) / segments.length
          : -1;
      const confidence = Math.min(1, Math.max(0, Math.exp(avgLogprob)));

      // Hallucination guard: high no_speech_prob OR known hallucination phrase
      const maxNoSpeechProb =
        segments.length > 0
          ? Math.max(
              ...segments.map((s: WhisperSegment) => s.no_speech_prob ?? 0)
            )
          : 1;
      const rawText = (transcription.text ?? "").trim().toLowerCase();
      const isHallucination =
        maxNoSpeechProb > 0.7 || HALLUCINATIONS.has(rawText);

      const transcript = isHallucination
        ? ""
        : (transcription.text ?? "").trim();
      const words: WhisperWord[] = isHallucination
        ? []
        : (transcription.words ?? []);

      // Upload to Cloudinary (non-fatal if it fails)
      let audioUrl = "";
      try {
        audioUrl = await uploadAudioToCloudinary(audio);
      } catch {
        // Transcript still works without audio storage
      }

      return NextResponse.json({
        transcript,
        confidence: isHallucination ? 0 : confidence,
        alternatives: transcript ? [transcript] : [],
        audioUrl,
        words,
      });
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      if (status === 429) {
        return NextResponse.json(
          {
            error: "Too many requests. Please try again in a moment.",
            code: "RATE_LIMIT",
          },
          { status: 429 }
        );
      }
      console.error("Transcribe error:", error);
      return internalError();
    }
  });
}
