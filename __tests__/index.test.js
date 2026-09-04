import pageLoader from "../src/pageLoader.js";
import nock from "nock";
import fs from "fs/promises";
import path from "node:path";
import os from "node:os";
import { generateFileName } from "../src/utils/pageLoaderHelperFunctions.js";
import paths from "../__fixtures__/paths.js";

nock.disableNetConnect();

let folder;
let params;
const url = "https://ru.hexlet.io/courses";

const [sourcePathImg, fakeImagePath, fakeLinkPath, fakeScriptPath, sourcePath] =
  paths();

//Хук, который делает новую временную папку перед каждым тестом
beforeEach(async () => {
  const pathPrefix = path.join(os.tmpdir(), "page-loader-");
  folder = await fs.mkdtemp(pathPrefix);
  params = [url, folder];
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
  await pageLoader(...params);
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
  await pageLoader(...params);
  const imgDirPath = path.resolve(folder, `${generateFileName(url, "_files")}`);
  const imgDir = await fs.readdir(imgDirPath);
  expect(imgDir).toHaveLength(1);
  const resultHtml = await fs.readFile(
    path.join(folder, generateFileName(url, "html")),
    "utf-8",
  );
  expect(resultHtml).toContain(
    "ru-hexlet-io-courses_files/ru-hexlet-io-assets-professions-nodejs.png",
  );
});

//Тестим замену href и src в <link> и <script> (шаг 4): заменяет только нужные ссылки, не трогая ссылки с других ресурсов
test(`Loads links and scripts`, async () => {
  const html = await fs.readFile(sourcePath, "utf-8");
  const fakeImage = await fs.readFile(fakeImagePath);
  const fakeLink = await fs.readFile(fakeLinkPath, "utf-8");
  const fakeScript = await fs.readFile(fakeScriptPath, "utf-8");
  nock("https://ru.hexlet.io")
    .get("/courses")
    .reply(200, html, {
      "Content-Type": "text/html; charset=utf-8",
    })
    .get("/assets/professions/nodejs.png")
    .reply(200, fakeImage, { "Content-Type": "image/png" })
    .get("/assets/application.css")
    .reply(200, fakeLink, { "Content-Type": "text/css" })
    .get("/packs/js/runtime.js")
    .reply(200, fakeScript, { "Content-Type": "text/javascript" });

  await pageLoader(...params);

  const resultHtml = await fs.readFile(
    path.join(folder, generateFileName(url, "html")),
    "utf-8",
  );

  const expected = [
    "https://cdn2.hexlet.io/assets/menu.css",
    "ru-hexlet-io-courses_files/ru-hexlet-io-assets-application.css",
    "ru-hexlet-io-courses_files/ru-hexlet-io-courses.html",
    "https://js.stripe.com/v3/",
    "ru-hexlet-io-courses_files/ru-hexlet-io-packs-js-runtime.js",
  ];
  expected.forEach((str) => expect(resultHtml).toContain(str));
});

//Тестим ошибочные случаи: 404 и т.д.
test("nonexistant page", async () => {
  const url = "http://i.don.t.exist.com";
  nock(url).get("/page").replyWithError("An error occured");
  await expect(pageLoader(...params)).rejects.toThrow();
});

//Тестим использование текущей папки для сохранения, если пользователь не назначил папку сам
test("no folder", async () => {
  const prevCwd = process.cwd();
  process.chdir(folder); // "no folder" => пишем в cwd, а cwd временно = temp-папка
  try {
    const currentParams = [url, undefined];
    const expected =
      "<html><head></head><body><h1>I AM SAVED SOMEWHERE</h1></body></html>";
    nock("https://ru.hexlet.io").get("/courses").reply(200, expected, {
      "Content-Type": "text/html; charset=utf-8",
    });
    await pageLoader(...currentParams);
    const result = await fs.readFile(
      path.resolve(generateFileName(url, "html")),
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
  const currentParams = [url, restrictedFolder];
  await expect(() => pageLoader(...currentParams)).rejects.toThrow(
    "Folder inaccessible",
  );
});

//Тестим проброс ошибки при ошибке загрузки дополнительных ресурсов
test("src/href error", async () => {
  const noimg = "<html><head></head><body><img src='/error'></body></html>";

  nock("https://ru.hexlet.io")
    .get("/courses")
    .reply(200, noimg, {
      "Content-Type": "text/html; charset=utf-8",
    })
    .get("/error")
    .replyWithError("This image does not exist");
  await expect(pageLoader(...params)).rejects.toThrow();
});

test("Saves a self-referencing link as html copy", async () => {
  const url = "https://localhost/blog/about";
  const html = [
    "<html><head>",
    '<link rel="canonical" href="/blog/about">', // ссылка на саму страницу
    "</head><body></body></html>",
  ].join("");

  nock("https://localhost")
    .get("/blog/about")
    .reply(200, html, { "Content-Type": "text/html; charset=utf-8" });

  await pageLoader(url, folder);

  // Ожидаемое имя файла — как формирует его сам код (generateFileName/prefixed)
  const expectedFilesDir = path.join(folder, generateFileName(url, "_files"));
  const expectedFilePath = path.join(
    expectedFilesDir,
    generateFileName(url, "html"),
  );

  // Файл должен реально существовать на диске
  const savedContent = await fs.readFile(expectedFilePath, "utf-8");

  // Его содержимое — это скачанная страница целиком
  expect(savedContent).toBe(html);

  // И ссылка в итоговом html должна указывать именно на этот локальный файл
  const resultHtml = await fs.readFile(
    path.join(folder, generateFileName(url, "html")),
    "utf-8",
  );
  expect(resultHtml).toContain(
    `${generateFileName(url, "_files")}/${generateFileName(url, "html")}`,
  );
});

//Корректно обрабатывает содержание тегов link, img и script, даже если они находятся не в привычных местах
test("finds <script> and <link> in the entirety of the document", async () => {
  const html = `<html><head><script src='/source_of_the_script.js'></script></head><img src="/fake_image.jpeg"><body></body><link href='/anything' /></html>`;
  const url = "https://ru.hexlet.io/courses";
  const fakeScript = await fs.readFile(fakeScriptPath, "utf-8");
  const fakeLink = await fs.readFile(fakeLinkPath, "utf-8");
  const fakeImage = await fs.readFile(fakeImagePath);

  nock("https://ru.hexlet.io")
    .get("/courses")
    .reply(200, html, { "Content-Type": "text/html; charset=utf-8" })
    .get("/source_of_the_script.js")
    .reply(200, fakeScript, { "Content-Type": "text/javascript" })
    .get("/anything")
    .reply(200, fakeLink, { "Content-Type": "text/css" })
    .get("/fake_image.jpeg")
    .reply(200, fakeImage, { "Content-Type": "image/png" });

  await pageLoader(url, folder);
  const resultHtml = await fs.readFile(
    path.join(folder, generateFileName(url, "html")),
    "utf-8",
  );

  const expected = [
    "ru-hexlet-io-courses_files/ru-hexlet-io-anything",
    "ru-hexlet-io-courses_files/ru-hexlet-io-source-of-the-script.js",
    "ru-hexlet-io-courses_files/ru-hexlet-io-fake-image.jpeg",
  ];

  expected.forEach((str) => expect(resultHtml).toContain(str));
});

//Не ломается, если атрибуты тегов отсутствуют
test("no attributes", async () => {
  const html =
    "<html><head><link></head><body><img><script></script></body></html>";
  nock("https://ru.hexlet.io")
    .get("/courses")
    .reply(200, html, { "Content-Type": "text/html; charset=utf-8" });

  await pageLoader(url, folder);
  const resultHtml = await fs.readFile(
    path.join(folder, generateFileName(url, "html")),
    "utf-8",
  );

  expect(resultHtml).toBe(html);
});
