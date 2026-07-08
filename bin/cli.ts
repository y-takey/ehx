#!/usr/bin/env bun

import { Command } from "commander";
import { scrapeCommand } from "../src/commands/scrape";
import { finishCommand } from "../src/commands/finish";
import { videoCompressCommand } from "../src/commands/video-compress";
import { videoTrimCommand } from "../src/commands/video-trim";

const program = new Command();

program.name("img-scraper").description("Image scraping CLI powered by Bun").version("1.0.0");

// --- scrape コマンド ---
program
  .command("scrape")
  .argument("<url>", "target page url")
  .option("-o, --out <dir>", "output directory under WORK_DIR")
  .option("-g, --group <name>", "catalog group")
  .option("-c, --concurrency <n>", "download concurrency", "5")
  .option("-p, --page <start-end-skip>", "1-3,5-10-2")
  .action(scrapeCommand);

// --- fin コマンド ---
program
  .command("fin")
  .argument("[url]", "target page url")
  .option("-o, --out <dir>", "output directory under WORK_DIR")
  .option("-n, --num <n>", "prefix number")
  .option("-d, --dist <distribution directory>")
  .option("-p, --page <xxx>", "unused")
  .action(finishCommand);

// 動画ファイルを縦横サイズを縮小しつつ圧縮する
program
  .command("video-compress")
  .argument("<file>", "target file")
  .option("-s, --scale <n>", "scale(1/n)")
  .action(videoCompressCommand);

// 動画ファイルから指定区間（複数可）を切り出し、1つのファイルに出力する
program
  .command("video-trim")
  .argument("<file>", "target file")
  .option("-r, --ranges <hh:mm:ss-hh:mm:ss>", "time ranges")
  .action(videoTrimCommand);

program.parse();
