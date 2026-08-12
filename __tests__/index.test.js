import createTasks from "../src/pageLoader.js";
import nock from "nock";
import fs from "fs/promises";
import path from "node:path";
import os from "node:os";
import { cwd } from "node:process";
import { generateFileName } from "../src/utils/pageLoaderHelperFunctions.js";
import { getImages, getLinks, getScripts } from "../src/utils/getters.js";
import paths from "../__fixtures__/paths.js";

nock.disableNetConnect();

let folder;
let tasks;
const url = "https://ru.hexlet.io/courses";

const [
  sourcePathImg,
  fakeImagePath,
  fakeLink1Path,
  fakeScriptPath,
  sourcePath,
] = paths();

//Хук, который делает новую временную папку перед каждым тестом
beforeEach(async () => {
  const pathPrefix = path.join(os.tmpdir(), "page-loader-");
  folder = await fs.mkdtemp(pathPrefix);
  tasks = createTasks({ folder, url });
});

//Хук, который удаляет временную папку
afterEach(async () => {
  nock.cleanAll();
  if (folder) {
    await fs.rm(folder, { recursive: true, force: true });
  }
});

//Тестим работу в принципе (шаг 2)
test(`Loads a page correctly`, async () => {
  const expected = "<html><head></head><body><h1>SUCCESS</h1></body></html>";
  nock("https://ru.hexlet.io").get("/courses").reply(200, expected, {
    "Content-Type": "text/html; charset=utf-8",
  });
  await tasks.run({ folder, url });
  const result = await fs.readFile(
    path.resolve(`${cwd()}`, folder, `${generateFileName(url, "html")}`),
    "utf-8",
  );

  expect(result).toBe(expected);
});

//Тестим скачку картинок и замену src (шаг 3)
test(`Loads all the images too`, async () => {
  const html = await fs.readFile(sourcePathImg, "utf-8");
  const fakeImage = await fs.readFile(fakeImagePath);
  nock("https://ru.hexlet.io")
    .get("/courses")
    .reply(200, html, {
      "Content-Type": "text/html; charset=utf-8",
    })
    .get("/assets/professions/nodejs.png")
    .reply(200, fakeImage, { "Content-Type": "image/png" });
  await tasks.run({ folder, url }).catch((err) => {
    console.error(err);
  });
  const imgDir = await fs.readdir(
    path.resolve(folder, `${generateFileName(url, "_files")}`),
  );
  expect(imgDir).toHaveLength(1);
  const resultHtml = await fs.readFile(
    path.resolve(folder, `${generateFileName(url, "html")}`),
  );
  expect(getImages(resultHtml)).toEqual([
    "ru-hexlet-io-courses_files/ru-hexlet-io-assets-professions-nodejs.png",
  ]);
});

//Тестим замену href и src в <link> и <script> (шаг 4): заменяет только нужные ссылки, не трогая ссылки с других ресурсов
test(`Loads links and scripts`, async () => {
  const html = await fs.readFile(sourcePath, "utf-8");
  const fakeImage = await fs.readFile(fakeImagePath);
  const fakeLink1 = await fs.readFile(fakeLink1Path, "utf-8");
  const fakeScript = await fs.readFile(fakeScriptPath, "utf-8");
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
  await tasks.run({ folder, url }).catch((err) => {
    console.error(err);
  });
  const resultHtml = await fs.readFile(
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

//Тестим ошибочные случаи: 404 и т.д.
test("nonexistant page", async () => {
  const url = "http://i.don.t.exist.com";
  nock(url).get("/page").replyWithError("An error occured");
  await expect(tasks.run({ folder, url })).rejects.toThrow();
});

//Тестим проброс ошибки при отсутствии папки назначения
test("no folder", () => {
  expect(() =>
    tasks.run({ folder: null, url }).catch((e) => {
      throw e;
    }),
  ).rejects.toThrow();
});

//Тестим проброс ошибки при отсутствии URL
test("no url", () => {
  expect(() => tasks.run({ folder })).rejects.toThrow();
});

//Тестим проброс ошибки при отсутствии доступа к папке
test("folder is unaccessible", async () => {
  const restrictedFolder = await fs.mkdtemp(
    path.join(os.tmpdir(), "restricted-"),
  );
  await fs.chmod(restrictedFolder, 0o000);
  tasks = createTasks({ folder: restrictedFolder, url });
  expect(() => tasks.run({ folder: restrictedFolder, url })).rejects.toThrow();
});

//Тестим проброс ошибки при ошибке загрузки дополнительных ресурсов
test("no src/href", async () => {
  const noimg = "<html><head></head><body><img src='/error'></body></html>";

  nock("https://ru.hexlet.io")
    .get("/courses")
    .reply(200, noimg, {
      "Content-Type": "text/html; charset=utf-8",
    })
    .get("/error")
    .replyWithError("This image does not exist");
  expect(tasks.run({ folder, url })).rejects.toThrow();
});
