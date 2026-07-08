/**
 * 動画ファイルを縦横サイズを縮小しつつ圧縮するスクリプト
 *
 * 使い方:
 *   bun run compress-video.ts <input> --scale [scale]
 *
 * 例:
 *   bun run compress-video.ts input.mp4 output.mp4       # 1/2に縮小(デフォルト)
 *   bun run compress-video.ts input.mp4 output.mp4 3     # 1/3に縮小
 *
 * 必要なもの: ffmpeg, ffprobe (brew install ffmpeg)
 */
import { join, basename, dirname } from "path";

const DEFAULT_SCALE = 2;
const CRF = 23; // 画質設定 (小さいほど高画質・大きいほど低画質、目安18-28)
const AUDIO_BITRATE_KBPS = 128;

async function getVideoSize(input: string): Promise<{ width: number; height: number }> {
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=s=x:p=0",
      input,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;

  if (code !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`ffprobe failed: ${stderr}`);
  }

  const match = stdout.trim().match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(`Could not parse video size from: "${stdout}"`);
  }

  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

// libx264はピクセル数が偶数である必要があるため、2の倍数に丸める
function toEven(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2);
}

async function runFfmpeg(args: string[]): Promise<void> {
  const proc = Bun.spawn(["ffmpeg", ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`ffmpeg failed with exit code ${code}`);
  }
}

export async function videoCompressCommand(inputFile: string, options: { scale: string }) {
  const outputFile = join(dirname(inputFile), "out_" + basename(inputFile));

  const scale = options.scale ? parseFloat(options.scale) : DEFAULT_SCALE;
  if (isNaN(scale) || scale <= 0) {
    console.error(`scaleには正の数値を指定してください: "${options.scale}"`);
    process.exit(1);
  }

  const file = Bun.file(inputFile);
  if (!(await file.exists())) {
    console.error(`入力ファイルが見つかりません: ${inputFile}`);
    process.exit(1);
  }

  const { width, height } = await getVideoSize(inputFile);
  const targetWidth = toEven(Math.round(width / scale));
  const targetHeight = toEven(Math.round(height / scale));

  console.log(`入力ファイル: ${inputFile} (${(file.size / 1e6).toFixed(1)} MB)`);
  console.log(`元の解像度: ${width}x${height}`);
  console.log(`縮小倍率: 1/${scale}`);
  console.log(`出力解像度: ${targetWidth}x${targetHeight}`);

  await runFfmpeg([
    "-y",
    "-i",
    inputFile,
    "-vf",
    `scale=${targetWidth}:${targetHeight}`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    String(CRF),
    "-c:a",
    "aac",
    "-b:a",
    `${AUDIO_BITRATE_KBPS}k`,
    "-movflags",
    "+faststart",
    outputFile,
  ]);

  const outFile = Bun.file(outputFile);
  console.log(`\n完了: ${outputFile} (${(outFile.size / 1e6).toFixed(1)} MB)`);
}
