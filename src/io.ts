import fs from "fs";
import fsPromises from "node:fs/promises";
import path from "path";
import sharp from "sharp";

import { DataJson } from "./interface";

// Display: w=2,560 x h=1,600
const maxHeight = 1600;
const catlogFileName = "data.json";

const baseDir = `${process.cwd()}/tmp`;

let existsImageDir = false;

export const createDir = dirPath => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
};

export const existJSON = key => {
  try {
    fs.statSync(`${baseDir}/${key}/${catlogFileName}`);
    return true;
  } catch (err) {
    return false;
  }
};

export const readJSON = (key: string): DataJson => {
  const data = fs.readFileSync(`${baseDir}/${key}/${catlogFileName}`, "utf8");
  return JSON.parse(data);
};

export const writeJSON = (key: string, json: DataJson) => {
  const dirPath = `${baseDir}/${key}`;
  createDir(dirPath);
  const filePath = `${dirPath}/${catlogFileName}`;
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2));

  return filePath;
};

export const imageDirPath = (key): string => {
  return `${baseDir}/${key}/images/`;
};

export const saveFile = async (key, filename, content) => {
  const dirPath = imageDirPath(key);
  if (!existsImageDir) {
    createDir(dirPath);
    existsImageDir = true;
  }
  const filePath = `${dirPath}/${filename}`;
  fs.writeFile(filePath, content, err => {
    if (err) {
      console.log("XXXXXX failed to save file XXXXXX");
      console.log(err);
      console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    }
  });
};

export const getImageNum = (key): number => {
  const dirPath = imageDirPath(key);
  const ret = fs.readdirSync(dirPath);
  return ret.length;
};

export const cropImage = async filePath => {
  const extension = filePath.split(".").pop();
  const saveFile = async (sharpImage: sharp.Sharp, seq) => sharpImage.toFile(`${filePath}.${seq}.${extension}`);
  const removeFile = async () => fsPromises.rm(filePath);

  const image = sharp(filePath, { failOnError: false });
  const { width, height } = await image.metadata();
  const regularWidth = Math.floor(height * 0.8);
  if (regularWidth > width) {
    if (height <= maxHeight) return;
    await saveFile(image.resize({ height: maxHeight }), 1);
    await removeFile();
    return;
  }

  const extract = (extractOPtions: Pick<sharp.Region, "left" | "width">): sharp.Sharp => {
    const clonedImage = image.clone().extract({ top: 0, height: height, ...extractOPtions });

    if (height <= maxHeight) return clonedImage;
    return clonedImage.resize({ height: maxHeight });
  };

  if (height * 1.2 < width) {
    const halfWidth = Math.floor(width / 2);
    const cropWidth = Math.min(halfWidth, regularWidth);

    await saveFile(extract({ left: halfWidth, width: cropWidth }), 1);
    await saveFile(extract({ left: halfWidth - cropWidth, width: cropWidth }), 2);
    await removeFile();
  } else {
    const left = Math.floor((width - regularWidth) / 2);
    await saveFile(extract({ left, width: regularWidth }), 1);
    await removeFile();
  }
};

export const getImagePaths = (dir: string) => {
  const filenames = fs
    .readdirSync(dir)
    .filter(filename => filename.match(/\.(jpg|jpeg|png)$/))
    .sort()
    .map(filename => path.join(dir, filename));

  return filenames;
};
