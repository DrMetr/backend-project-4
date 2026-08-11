#!/usr/bin/env node
import debug from "debug";
import fs from "fs/promises";
import replaceSrc from "./utils/replaceSrc.js";
import {
  getInfo,
  makeRequest,
  makeSrcList,
  checkFolderAccessibility,
} from "./utils/pageLoaderHelperFunctions.js";
import path from "node:path";

const log = debug("page-loader");
const pageLoader = (folder, url) => {
  log("Logging is on");
  if (!url) {
    log("No url");
    throw new Error("No url specified, try again");
  }
  if (!folder) {
    log("No folder");
    throw new Error("No folder specified, try again");
  }
  const { filepath, filesFolderName, host, prefix, filesFolderPath } = getInfo(
    folder,
    url,
  );
  let html = "";
  let srcList = [];

  return checkFolderAccessibility(folder)
    .catch((err) => {
      console.error("An error occured");
      log("Folder inaccessible");
      throw new Error(`The folder specified is inaccessible: ${err}`);
    })
    .then(() => {
      return makeRequest(url)
        .catch((err) => {
          console.error(`An error occured: ${err}`);
          throw new Error(err);
        })
        .then((data) => {
          log("Request fulfilled");
          html = data;
          srcList = makeSrcList(html, host, url, prefix);
          const srcListPromises = srcList.map((item) => {
            const { source, isCallable } = item;
            if (isCallable) {
              return makeRequest(new URL(source, url).toString());
            }
            return source;
          });
          return fs
            .mkdir(filesFolderPath, { recursive: true })
            .then(() => Promise.all(srcListPromises));
        })

        .then((data) => {
          const createFilesPromises = srcList.map((_, index) => {
            const filePath = srcList[index].sourcePath;
            if (srcList[index].isCallable) {
              return fs.writeFile(
                path.resolve(folder, filesFolderName, filePath),
                data[index],
              );
            }
            return null;
          });
          return Promise.all(createFilesPromises).then(() => {
            log(`Assets saved to ${filesFolderPath}`);
          });
        })
        .then(() => {
          log("Preparing the final HTML");
          const newHtml = replaceSrc(html, srcList, filesFolderName);
          return fs.writeFile(filepath, newHtml);
        });
    });
};

export default pageLoader;
