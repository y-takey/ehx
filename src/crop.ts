import { getImagePaths, cropImage } from "./io";

const [, , targetDir] = process.argv;

const main = async () => {
  const imagePaths = getImagePaths(targetDir);

  for (let imagePath of imagePaths) {
    await cropImage(imagePath);
  }
};

main();
