import fs from "fs";
import path from "path";
import sharp from "sharp";

import { createDir } from "./io";

const [, , targetDir] = process.argv;

const cropImage = async (filename) => {
  console.log("crop:", filename);
  const outputDir = path.join(targetDir, "output");
  createDir(outputDir);
  const outputPath = path.join(outputDir, filename);
  const extension = filename.split(".").pop();

  const image = sharp(path.join(targetDir, filename));
  const metadata = await image.metadata();

  const rightWidth = Math.round(metadata.width * 0.5);
  const leftWidth = metadata.width - rightWidth;
  const extractOPtions = { top: 0, height: metadata.height };

  await image.extract({ ...extractOPtions, left: leftWidth, width: rightWidth }).toFile(`${outputPath}.1.${extension}`);
  await image.extract({ ...extractOPtions, left: 0, width: leftWidth }).toFile(`${outputPath}.2.${extension}`);
};

const main = async () => {
  const filenames = fs.readdirSync(targetDir);

  for (let filename of filenames) {
    if (filename.match(/\.(jpg|jpeg|png)$/)) {
      await cropImage(filename);
    }
  }
};

main();