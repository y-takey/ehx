const fs = require("fs");
const jsonStringify = require("json-stringify-pretty-compact");

const catlogFileName = "data.json";

const baseDir = `${process.cwd()}/tmp`;

let existsImageDir = false;

const createDir = dirPath => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
};

const readJSON = key => {
  const data = fs.readFileSync(`${baseDir}/${key}/${catlogFileName}`);
  return JSON.parse(data);
};

const writeJSON = (key, json) => {
  const dirPath = `${baseDir}/${key}`;
  createDir(dirPath);
  const filePath = `${dirPath}/${catlogFileName}`;
  fs.writeFileSync(filePath, jsonStringify(json));

  return filePath;
};

const saveFile = async (key, filename, content) => {
  const dirPath = `${baseDir}/${key}/images/`;
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

module.exports = { readJSON, writeJSON, saveFile };
