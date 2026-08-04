import pageLoader from "../src/pageLoader";
import nock from "nock";
import * as fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cwd } from "node:process";
import generateFileName from "../src/utils/generateFileName";
import getLinks from "../src/utils/getLinks";
import getScripts from "../src/utils/getScripts";
import getImagesPaths from "../src/utils/getImagesPaths";

nock.disableNetConnect();

let folder;

const url = "https://ru.hexlet.io/courses";
const sourcePathImg = path.resolve(
  `${cwd()}`,
  "__fixtures__",
  "ru-hexlet-io-courses.html",
);
const fakeImagePath = path.resolve(
  `${cwd()}`,
  "__fixtures__",
  "assets/professions/nodejs.png",
);

const fakeLink1Path = path.resolve(
  `${cwd()}`,
  "__fixtures__",
  "assets/application.css",
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

//Хук, который делает новую временную папку перед каждым тестом
beforeEach(async () => {
  const pathPrefix = path.join(os.tmpdir(), "page-loader-");
  folder = await fs.promises.mkdtemp(pathPrefix);
});

//Хук, который удаляет временную папку
afterEach(async () => {
  nock.cleanAll();
  if (folder) {
    await fs.promises.rm(folder, { recursive: true, force: true });
  }
});

//Тестим работу в принципе (шаг 2)
test(`Loads a page correctly`, async () => {
  const expected = "<html><head></head><body><h1>SUCCESS</h1></body></html>";
  nock("https://ru.hexlet.io").get("/courses").reply(200, expected, {
    "Content-Type": "text/html; charset=utf-8",
  });
  await pageLoader(folder, url);
  const result = await fs.promises.readFile(
    path.resolve(`${cwd()}`, folder, `${generateFileName(url, "html")}`),
    "utf-8",
  );

  expect(result).toBe(expected);
});

//Тестим скачку картинок и замену src (шаг 3)
test(`Loads all the images too`, async () => {
  const html = await fs.promises.readFile(sourcePathImg, "utf-8");
  const fakeImage = await fs.promises.readFile(fakeImagePath);
  nock("https://ru.hexlet.io")
    .get("/courses")
    .reply(200, html, {
      "Content-Type": "text/html; charset=utf-8",
    })
    .get("/assets/professions/nodejs.png")
    .reply(200, fakeImage, { "Content-Type": "image/png" });
  await pageLoader(folder, url);
  const imgDir = await fs.promises.readdir(
    path.resolve(folder, `${generateFileName(url, "_files")}`),
  );
  expect(imgDir).toHaveLength(1);
  const resultHtml = await fs.promises.readFile(
    path.resolve(folder, `${generateFileName(url, "html")}`),
  );
  expect(getImagesPaths(resultHtml)).toEqual([
    "ru-hexlet-io-courses_files/ru-hexlet-io-assets-professions-nodejs.png",
  ]);
});

//Тестим замену href и src в <link> и <script> (шаг 4)
test(`Loads links and scripts`, async () => {
  nock.emitter.on("no match", (req) => {
    console.log("Nock missed match for:", req.method, req.path);
  });
  const html = await fs.promises.readFile(sourcePath, "utf-8");
  const fakeImage = await fs.promises.readFile(fakeImagePath);
  const fakeLink1 = await fs.promises.readFile(fakeLink1Path, "utf-8");
  const fakeScript = await fs.promises.readFile(fakeScriptPath, "utf-8");
  nock("https://ru.hexlet.io")
    .get("/courses")
    .reply(200, html, {
      "Content-Type": "text/html; charset=utf-8",
    })
    .get("/assets/professions/nodejs.png")
    .reply(200, fakeImage, { "Content-Type": "image/png" })
    .get("/assets/application.css")
    .reply(200, fakeLink1, { "Content-Type": "text/css" })
    .get("/packs/js/runtime.js")
    .reply(200, fakeScript, { "Content-Type": "text/javascript" });

  await pageLoader(folder, url);
  const resultHtml = await fs.promises.readFile(
    path.resolve(folder, `${generateFileName(url, "html")}`),
  );
  expect(getLinks(resultHtml)).toEqual([
    "https://cdn2.hexlet.io/assets/menu.css",
    "ru-hexlet-io-courses_files/ru-hexlet-io-assets-application.css",
    "ru-hexlet-io-courses_files/ru-hexlet-io-courses.html",
  ]);
  expect(getScripts(resultHtml)).toEqual([
    "https://js.stripe.com/v3/",
    "ru-hexlet-io-courses_files/ru-hexlet-io-packs-js-runtime.js",
  ]);
});
