import pageLoader from "../src/pageLoader.js";
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
let params;
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
  params = { folder, url };
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
  await pageLoader(params);
  const result = await fs.readFile(
    path.resolve(folder, `${generateFileName(url, "html")}`),
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
  await pageLoader(params);
  const imgDirPath = path.resolve(folder, `${generateFileName(url, "_files")}`);
  const imgDir = await fs.readdir(imgDirPath);
  console.log("ImgDirPath: ", imgDirPath);
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
  await pageLoader(params);
  const resultHtml = await fs.readFile(
    path.resolve(cwd(), folder, `${generateFileName(url, "html")}`),
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
  await expect(pageLoader(params)).rejects.toThrow();
});

//Тестим использование текущей папки для сохранения, если пользователь не назначил папку сам
test("no folder", async () => {
  const prevCwd = process.cwd();
  process.chdir(folder); // "no folder" => пишем в cwd, а cwd временно = temp-папка
  try {
    const currentParams = { folder: undefined, url };
    const expected =
      "<html><head></head><body><h1>I AM SAVED SOMEWHERE</h1></body></html>";
    nock("https://ru.hexlet.io").get("/courses").reply(200, expected, {
      "Content-Type": "text/html; charset=utf-8",
    });
    await pageLoader(currentParams);
    const result = await fs.readFile(
      path.resolve(cwd(), generateFileName(url, "html")),
      "utf-8",
    );
    expect(result).toBe(expected);
  } finally {
    process.chdir(prevCwd);
  }
});

//Тестим проброс ошибки при отсутствии доступа к папке
test("folder is unaccessible", async () => {
  const restrictedFolder = await fs.mkdtemp(
    path.join(os.tmpdir(), "restricted-"),
  );
  await fs.chmod(restrictedFolder, 0o000);
  const currentParams = { folder: restrictedFolder, url };
  expect(() => pageLoader(currentParams)).rejects.toThrow(
    "Folder inaccessible",
  );
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
  await expect(pageLoader(params)).rejects.toThrow(
    "Error saving https://ru.hexlet.io/error",
  );
});
