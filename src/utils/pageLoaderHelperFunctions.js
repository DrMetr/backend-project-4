import path from "node:path";
import { createRequire } from "module";
import axios from "axios";
import fs from "fs/promises";
import { getLinks, getImages, getScripts } from "./getters.js";

const require = createRequire(import.meta.url);
require("axios-debug-log");

const checkFolderAccessibility = (folderPath) => {
  //проверяет доступность папки
  return fs
    .access(folderPath, fs.constants.F_OK | fs.constants.R_OK)
    .then(() => {
      return true;
    })
    .catch((error) => {
      if (error.code === "ENOENT") {
        console.error("Folder does not exist");
      } else if (error.code === "EACCES") {
        console.error("Permission denied");
      } else {
        console.error("An error occurred:", error.message);
      }
      throw error;
    });
};

const makeRequest = (url) => {
  //отправляет запрос
  return axios
    .get(url, {
      responseType: "arraybuffer",
    })
    .then((response) => response.data)
    .catch((error) => {
      throw new Error(error);
    });
};

const isTheSameUrl = (relUrl, base, targetUrl) => {
  // проверяет, является ли относительная ссылка сыылкой на ту же страницу
  targetUrl = new URL(targetUrl);
  if (!URL.canParse(relUrl)) {
    return new URL(relUrl, targetUrl.protocol + "//" + base) === targetUrl;
  }
  return false;
};

const isCallableUrl = (item, host) => {
  // то есть значение src или href, в котором хост совпадает с хостом таргетного сайта и который нужно заменить как в задании, а не оставить как было
  if (URL.canParse(item)) {
    return new URL(item).host === host;
  }
  if (!path.extname(item)) {
    return false;
  }
  return true;
};

const prefixed = (source, host, prefix) => {
  //Добавляет префикс к файлам
  if (!source.includes(host)) {
    return `${prefix + generateFileName(source)}`;
  }
  return generateFileName(source);
};

const generateFileName = (link, extension = path.extname(link).slice(1)) => {
  //разбивает название ссылки по шаблону ru.hexlet.io -> ru-hexlet-io
  let newLink = link
    .split(/[^a-zA-Z0-9]+/gi)
    .filter((piece) => piece !== "http" && piece !== "https" && piece !== "")
    .join("-");
  if (newLink.endsWith(extension)) newLink = newLink.replace(/-[^-]*$/, "");
  return (
    newLink +
    `${extension === "_files" || extension === "" ? "" : "."}${extension || ""}`
  );
};

const getInfo = (folder, url) => {
  //создает нужные для pageLoader константы
  const filepath = path.resolve(folder, generateFileName(url, "html")),
    filesFolderName = generateFileName(url, "_files"),
    host = new URL(url).host,
    prefix = host.replace(/[^a-zA-Z0-9]+/gi, "-") + "-",
    filesFolderPath = path.join(folder, filesFolderName);
  return { filepath, filesFolderName, host, prefix, filesFolderPath };
};

const makeSrcList = (html, host, url, prefix) => {
  // создает массив объектов с информацией о каждом href или src тегов img, link и script
  const srcList = [
    ...getImages(html).map((src) => {
      return { type: "img", source: src };
    }),
    ...getLinks(html).map((link) => {
      return { type: "link", source: link };
    }),
    ...getScripts(html).map((src) => {
      return { type: "script", source: src };
    }),
  ];
  return srcList.map((item) => {
    const { source } = item;
    if (!isCallableUrl(source, host)) {
      return { ...item, isCallable: false, sourcePath: source };
    } else if (isTheSameUrl(source, host, url)) {
      return {
        ...item,
        isCallable: false,
        sourcePath: prefixed(source, host, prefix),
      };
    } else {
      return {
        ...item,
        isCallable: true,
        sourcePath: prefixed(source, host, prefix),
      };
    }
  });
};

export {
  getInfo,
  prefixed,
  generateFileName,
  isCallableUrl,
  isTheSameUrl,
  makeRequest,
  makeSrcList,
  checkFolderAccessibility,
};
