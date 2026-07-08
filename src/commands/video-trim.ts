/**
 * 動画ファイルから指定区間（複数可）を切り出し、1つのファイルに結合して出力するスクリプト
 *
 * 使い方:
 *   bun run cut-video.ts <input> -r <ranges>
 *
 * <ranges> の形式:
 *   "hh:mm:ss-hh:mm:ss" をカンマ区切りで複数指定可能
 *   例: "00:00:10-00:00:40,00:01:20-00:02:00"
 *
 *   hh は省略可能（その場合は 00 を補完）
 *   例: "00:10-00:40" -> "00:00:10-00:00:40" として扱う
 *       "1:20-2:00"   -> "00:01:20-00:02:00" として扱う
 *
 * 前提: システムに ffmpeg がインストールされていること (mac: brew install ffmpeg)
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, extname, basename, dirname } from "path";

type Mode = "copy" | "reencode";

function printUsageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  process.exit(1);
}

/**
 * "h:mm:ss" / "hh:mm:ss" / "m:ss" / "mm:ss" 形式を受け取り、
 * "hh:mm:ss" 形式に正規化する（hh省略時は00を補完）。
 */
function normalizeTime(raw: string): string {
  const trimmed = raw.trim();
  const parts = trimmed.split(":");

  if (parts.length !== 2 && parts.length !== 3) {
    throw new Error(`時刻の形式が不正です: "${raw}" (例: "1:30:00", "30:00", "00:30:00")`);
  }

  if (parts.length === 2) {
    parts.unshift("00");
  }

  const [h, m, s] = parts;

  for (const [label, value] of [
    ["時(hh)", h],
    ["分(mm)", m],
  ] as const) {
    if (!/^\d{1,2}$/.test(value)) {
      throw new Error(`${label}部分が不正です: "${raw}" (値: "${value}")`);
    }
  }

  // 秒は小数点を許容 (例: 12.345)
  if (!/^\d{1,2}(\.\d+)?$/.test(s)) {
    throw new Error(`秒(ss)部分が不正です: "${raw}" (値: "${s}")`);
  }

  const hh = h.padStart(2, "0");
  const mm = m.padStart(2, "0");
  // 秒は整数部のみ2桁ゼロ埋め、小数部はそのまま
  const [secInt, secFrac] = s.split(".");
  const ss = secInt.padStart(2, "0") + (secFrac !== undefined ? `.${secFrac}` : "");

  return `${hh}:${mm}:${ss}`;
}

interface TimeRange {
  start: string; // 正規化済み hh:mm:ss[.ms]
  end: string; // 正規化済み hh:mm:ss[.ms]
  raw: string;
}

function parseRanges(rangesArg: string): TimeRange[] {
  const segments = rangesArg
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (segments.length === 0) {
    throw new Error("区間が指定されていません");
  }

  return segments.map(seg => {
    const m = seg.match(/^(.+?)-(.+)$/);
    if (!m) {
      throw new Error(`区間の形式が不正です: "${seg}" (期待形式: "hh:mm:ss-hh:mm:ss")`);
    }
    const [, startRaw, endRaw] = m;
    const start = normalizeTime(startRaw);
    const end = normalizeTime(endRaw);
    return { start, end, raw: seg };
  });
}

function timeToSeconds(t: string): number {
  const [h, m, s] = t.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

async function runFfmpeg(args: string[]): Promise<void> {
  console.log(`  ffmpeg ${args.map(a => `"${a}"`).join(" ")}`);
  const proc = Bun.spawn(["ffmpeg", ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`ffmpegがエラー終了しました (exit code: ${exitCode})`);
  }
}

async function cutSegment(input: string, range: TimeRange, output: string, mode: Mode): Promise<void> {
  const args = ["-ss", range.start, "-to", range.end, "-i", input];

  if (mode === "copy") {
    args.push("-c", "copy", "-avoid_negative_ts", "make_zero");
  } else {
    args.push("-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k");
  }

  args.push("-y", output);

  console.log(
    `\n[${range.raw}] -> ${output} (duration: ${(timeToSeconds(range.end) - timeToSeconds(range.start)).toFixed(3)}s)`,
  );

  await runFfmpeg(args);
}

async function concatSegments(segmentPaths: string[], output: string, mode: Mode, workDir: string): Promise<void> {
  const listPath = join(workDir, "concat_list.txt");
  const listContent = segmentPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  writeFileSync(listPath, listContent, "utf-8");

  const args = ["-f", "concat", "-safe", "0", "-i", listPath];

  // 各セグメントは既に同一のコーデック設定（copy時は元動画と同一、
  // reencode時は同一パラメータで再エンコード済み）なので、
  // 結合時は常に -c copy でOK
  args.push("-c", "copy", "-y", output);

  await runFfmpeg(args);
}

export async function videoTrimCommand(inputFile: string, options: { ranges: string }) {
  let mode: Mode = "reencode";

  const outputFile = join(dirname(inputFile), "out_" + basename(inputFile));

  if (!existsSync(inputFile)) {
    printUsageAndExit(`入力ファイルが見つかりません: ${inputFile}`);
  }

  if (existsSync(outputFile)) {
    printUsageAndExit(`出力ファイルが既に存在します（上書き防止）: ${outputFile}`);
  }

  let ranges: TimeRange[];
  try {
    ranges = parseRanges(options.ranges);
  } catch (e) {
    printUsageAndExit((e as Error).message);
  }

  // 開始 < 終了 のバリデーション
  for (const r of ranges) {
    if (timeToSeconds(r.start) >= timeToSeconds(r.end)) {
      printUsageAndExit(`開始時刻が終了時刻以降になっています: "${r.raw}" (${r.start} -> ${r.end})`);
    }
  }

  console.log(`入力: ${inputFile}`);

  // 区間が1つだけなら直接出力、複数なら一時ディレクトリで切り出してから結合
  if (ranges.length === 1) {
    try {
      await cutSegment(inputFile, ranges[0], outputFile, mode);
    } catch (e) {
      console.error(`エラー: ${(e as Error).message}`);
      process.exit(1);
    }
    console.log(`\n完了: ${outputFile}`);
    return;
  }

  const ext = extname(outputFile) || ".mp4";
  const workDir = mkdtempSync(join(tmpdir(), "cut-video-"));

  try {
    const segmentPaths: string[] = [];

    for (let i = 0; i < ranges.length; i++) {
      const segPath = join(workDir, `segment_${String(i + 1).padStart(2, "0")}${ext}`);
      await cutSegment(inputFile, ranges[i], segPath, mode);
      segmentPaths.push(segPath);
    }

    await concatSegments(segmentPaths, outputFile, mode, workDir);

    console.log(`\n完了: ${outputFile}`);
  } catch (e) {
    console.error(`エラー: ${(e as Error).message}`);
    process.exit(1);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
