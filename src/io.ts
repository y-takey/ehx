import fs from "fs";
import jsonStringify from "json-stringify-pretty-compact";

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

export const saveFile = async (key, filename, content) => {
  const dirPath = `${baseDir}/${key}/images/`;
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
