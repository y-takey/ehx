import fs from "fs";
import path from "path";
import jsonStringify from "json-stringify-pretty-compact";
import sharp from "sharp";

import { DataJson } from "./interface"

const catlogFileName = "data.json";

const baseDir = `${process.cwd()}/tmp`;

let existsImageDir = false;

export const createDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
};

export const existJSON = (key) => {
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
  fs.writeFileSync(filePath, jsonStringify(json));

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
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.log("XXXXXX failed to save file XXXXXX");
      console.log(err);
      console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    }
  });
};

export const getImageNum = (key): number => {
  const dirPath = imageDirPath(key);
  const ret = fs.readdirSync(dirPath)
  return ret.length
};

export const cropImage = async (filePath) => {
  const extension = filePath.split(".").pop();

  const image = sharp(filePath, { failOnError: false });
  const { width, height } = await image.metadata();
  const regularWidth = Math.floor(height * 0.8)
  if (regularWidth > width) return;

  const extractOPtions = { top: 0, height: height };
  const removeFile = () => {
    fs.unlink(filePath, () => {})
  }

  if (height * 1.2 < width) {
    const halfWidth = Math.floor(width / 2)
    const cropWidth = Math.min(halfWidth, regularWidth)
  
    await image.extract({ ...extractOPtions, left: halfWidth, width: cropWidth }).toFile(`${filePath}.1.${extension}`);
    await image.extract({ ...extractOPtions, left: halfWidth - cropWidth, width: cropWidth }).toFile(`${filePath}.2.${extension}`).then(removeFile);
  } else {
    const left = Math.floor((width - regularWidth) / 2)
    await image.extract({ ...extractOPtions, left, width: regularWidth }).toFile(`${filePath}.1.${extension}`).then(removeFile);
  }
};

export const getImagePaths = (dir: string) => {
  const filenames = fs.readdirSync(dir).
    filter(filename => filename.match(/\.(jpg|jpeg|png)$/)).sort().
    map(filename => path.join(dir, filename));

  return filenames
}
