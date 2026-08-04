#!/usr/bin/env node
import * as fs from "node:fs";
import makeRequest from "./utils/makeRequest.js";
import generateFileName from "./utils/generateFileName.js";
import getImagesPath from "./utils/getImagesPaths.js";
import replaceSrc from "./utils/replaceSrc.js";
import getScripts from "./utils/getScripts.js";
import getLinks from "./utils/getLinks.js";
import path from "node:path";

// Version 2
const { promises: fsp } = fs;

const isTheSameUrl = (relUrl, base, targetUrl) => {
  targetUrl = new URL(targetUrl);
  if (!URL.canParse(relUrl)) {
    return new URL(relUrl, targetUrl.protocol + "//" + base) === targetUrl;
  }
  return false;
}; // проверяет, является ли относительная ссылка сыылкой на ту же страницу

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

const pageLoader = (folder, url) => {
  const filepath = path.resolve(folder, generateFileName(url, "html")),
    filesFolderName = generateFileName(url, "_files"),
    host = new URL(url).host,
    prefix = host.replace(/[^a-zA-Z0-9]+/gi, "-") + "-";

  let srcList = [],
    additionalFiles = [];

  return new Promise((resolve) => {
    resolve(makeRequest(url));
  })

    .then((data) => {
      return fsp.writeFile(filepath, data);
    })
    .then(() => {
      return fsp.readFile(filepath, "utf-8");
    })

    .then((html) => {
      srcList = [
        ...getImagesPath(html).map((src) => {
          return { type: "img", source: src };
        }),
        ...getLinks(html).map((link) => {
          return { type: "link", source: link };
        }),
        ...getScripts(html).map((src) => {
          return { type: "script", source: src };
        }),
      ];
      srcList.forEach((item) => {
        const { type, source } = item;
        const prefixed = () => {
          if (!source.includes(host)) {
            return `${prefix + generateFileName(source)}`;
          }
          return generateFileName(source);
        };
        if (!isCallableUrl(source, host)) {
          additionalFiles.push({ type, sourcePath: source, isCallable: false });
          item.isCallable = false;
        } else if (isTheSameUrl(source, host, url)) {
          additionalFiles.push({
            type,
            isCallable: false,
            sourcePath: prefixed(),
          });
        } else {
          item.isCallable = true;
          additionalFiles.push({
            type,
            isCallable: true,
            sourcePath: prefixed(),
          });
        }
      });
      const srcListPromises = srcList.map((item) => {
        const { source, isCallable } = item;
        if (isCallable) {
          return makeRequest(new URL(source, url).toString());
        }
        return source;
      });

      return fsp
        .mkdir(path.join(folder, filesFolderName), { recursive: true })
        .then(() => Promise.all(srcListPromises));
    })
    .then((data) => {
      const createFilesPromises = srcList
        .map(({ source }, index) => {
          {
            return { content: data[index], source: source };
          }
        })
        .map(({ content }, index) => {
          const filePath = additionalFiles[index].sourcePath;
          if (srcList[index].isCallable) {
            return fs.promises.writeFile(
              path.resolve(folder, filesFolderName, filePath),
              content,
            );
          }
          return null;
        });
      return Promise.all(createFilesPromises);
    })
    .then(() => {
      return fsp.readFile(filepath, "utf-8");
    })
    .then((html) => {
      const newHtml = replaceSrc(html, additionalFiles, filesFolderName);
      return fsp.writeFile(filepath, newHtml);
    });
};

export default pageLoader;
