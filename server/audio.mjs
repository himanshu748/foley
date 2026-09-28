import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fail } from "./store.mjs";
function run(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "",
      error = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error("Audio processing timed out."));
    }, 15000);
    p.stdout.on("data", (x) => {
      if (output.length < 100000) output += x;
    });
    p.stderr.on("data", (x) => {
      if (error.length < 2000) error += x;
    });
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("exit", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(output)
        : reject(new Error("Audio could not be decoded."));
    });
  });
}
export async function normalizeAudio(input) {
  if (
    !Buffer.isBuffer(input) ||
    input.length < 44 ||
    input.length > 4 * 1024 * 1024
  )
    fail(413, "Choose an audio recording smaller than 4 MB.");
  const dir = await mkdtemp(join(tmpdir(), "foley-"));
  try {
    const source = join(dir, "input"),
      output = join(dir, "take.wav");
    await writeFile(source, input, { mode: 0o600 });
    let probe;
    try {
      probe = JSON.parse(
        await run("ffprobe", [
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-format_whitelist",
          "wav,mov,matroska,webm,ogg,mp3,aac,flac",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          source,
        ]),
      );
    } catch {
      fail(
        400,
        "This file is not a readable audio recording. Try WAV, M4A, WebM or Ogg.",
      );
    }
    const audio = probe.streams?.filter((s) => s.codec_type === "audio") ?? [];
    if (
      audio.length !== 1 ||
      probe.streams.some((s) => s.codec_type === "video")
    )
      fail(400, "Choose an audio-only file with one sound track.");
    const duration = Number(probe.format?.duration ?? audio[0].duration);
    if (Number.isFinite(duration) && (duration < 0.2 || duration > 8.3))
      fail(
        400,
        "A take must be between 0.2 and 8 seconds. Trim it and try again.",
      );
    try {
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        "wav,mov,matroska,webm,ogg,mp3,aac,flac",
        "-i",
        source,
        "-map",
        "0:a:0",
        "-t",
        "8.4",
        "-ac",
        "1",
        "-ar",
        "48000",
        "-af",
        "loudnorm=I=-20:TP=-3:LRA=7",
        "-c:a",
        "pcm_s16le",
        output,
      ]);
    } catch {
      fail(400, "This recording could not be prepared. Record another take.");
    }
    const bytes = await readFile(output);
    let offset = 12,
      pcm;
    while (offset + 8 <= bytes.length) {
      const size = bytes.readUInt32LE(offset + 4);
      if (bytes.toString("ascii", offset, offset + 4) === "data") {
        pcm = bytes.subarray(
          offset + 8,
          Math.min(bytes.length, offset + 8 + size),
        );
        break;
      }
      offset += 8 + size + (size % 2);
    }
    if (!pcm) fail(400, "This recording could not be prepared.");
    const actual = pcm.length / 96000;
    const peaks = Array.from({ length: 24 }, (_, i) => {
      let max = 0;
      const start = Math.floor((i * pcm.length) / 24 / 2) * 2,
        end = Math.floor(((i + 1) * pcm.length) / 24 / 2) * 2;
      for (let n = start; n < end; n += 2)
        max = Math.max(max, Math.abs(pcm.readInt16LE(n)));
      return Math.round((max / 32768) * 100) / 100;
    });
    if (actual < 0.2 || actual > 8.31)
      fail(400, "A take must be between 0.2 and 8 seconds.");
    return { bytes, duration: Math.round(actual * 100) / 100, peaks };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
