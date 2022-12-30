import fs from "fs";
import path from "path";
import sharp from "sharp";
import yargs from 'yargs/yargs'
import pc from "picocolors";

import { imageDirPath, getImagePaths, cropImage } from "./io";

const QUALITY = 50

const argv = yargs(process.argv.slice(2)).options({ n: { type: "string", default: "01" } }).parseSync()
const key = argv._[0] as string;
const dir = imageDirPath(key)

const crop = async () => {
  const imagePaths = getImagePaths(dir);

  for (let imagePath of imagePaths) {
    await cropImage(imagePath)
  }
}

const rename = async () => {
  const imagePaths = getImagePaths(dir);
  let counter = 0

  for (let srcPath of imagePaths) {
    const dstFile = path.join(dir, `${argv.n}_${String(++counter).padStart(5, '0')}.jpg`)
    sharp(srcPath).jpeg({ quality: QUALITY }).toFile(dstFile).then(() => {
      fs.unlink(srcPath, () => {})
    });
  }
}

const main = async () => {
  await crop()
  await rename()

  console.log(pc.green(`---- [${key}] Completed -----`));
};

main();
