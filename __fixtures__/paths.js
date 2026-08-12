import path from "node:path";
import { cwd } from "node:process";

export default () => {
  const sourcePathImg = path.resolve(
    `${cwd()}`,
    "__fixtures__",
    "ru-hexlet-io-courses.html",
  );
  const fakeImagePath = path.resolve(`${cwd()}`, "__fixtures__", "nodejs.png");

  const fakeLink1Path = path.resolve(
    `${cwd()}`,
    "__fixtures__",
    "application.css",
  );

  const fakeScriptPath = path.resolve(
    `${cwd()}`,
    "__fixtures__",
    "packs-js-runtime.js",
  );

  const sourcePath = path.resolve(
    `${cwd()}`,
    "__fixtures__",
    "ru-hexlet-io-courses-links-and-scripts.html",
  );

  return [
    sourcePathImg,
    fakeImagePath,
    fakeLink1Path,
    fakeScriptPath,
    sourcePath,
  ];
};
