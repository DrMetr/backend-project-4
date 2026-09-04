import Listr from "listr";
import debug from "debug";
import fs from "fs/promises";
import replaceSrc from "./utils/replaceSrc.js";
import {
  getInfo,
  makeSrcList,
  checkFolderAccessibility,
  getAsset,
} from "./utils/pageLoaderHelperFunctions.js";
import { cwd } from "node:process";
import axios from "axios";
import { addLogger } from "axios-debug-log";
import path from "node:path";

addLogger(axios);

const createTasks = (url, folder = cwd()) => {
  const log = debug("page-loader");
  log("Logging is on");

  const tasks = new Listr(
    [
      {
        title: "Checking if the output is accessible",
        task: (task) => {
          return checkFolderAccessibility(folder)
            .then(() => {
              task.title = "Output directory is accessible";
              log("Output directory is accessible");
            })
            .catch(() => {
              const message = "Folder inaccessible";
              log(message);
              task.title = message;
              throw new Error(message);
            });
        },
      },
      {
        title: "Requesting the page",
        task: (ctx, task) => {
          return axios
            .get(url, {
              //Заголовки ниже - для обхода ошибки 403
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                Accept: "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
              },
            })
            .catch((err) => {
              const message = `Error requesting ${url}: status code ${err.response.status}`;
              log(message);
              task.title = message;
              throw new Error(message);
            })
            .then((response) => {
              log("Page request fulfilled");
              task.title = "Page request fulfilled";
              const {
                filepath,
                filesFolderName,
                host,
                prefix,
                filesFolderPath,
              } = getInfo(folder, url);
              ctx.html = response.data;
              Object.assign(ctx, {
                filepath,
                filesFolderName,
                host,
                prefix,
                filesFolderPath,
              });
            });
        },
      },
      {
        title: "Processing assets",
        task: (ctx, task) => {
          const { host, prefix, html, filesFolderPath } = ctx;
          ctx.srcList = makeSrcList(html, host, url, prefix);
          return fs
            .mkdir(filesFolderPath, { recursive: true })

            .catch(() => {
              task.title = "Error creating assets directory";
              log("Error creating assets directory");
              throw new Error("Error creating assets directory");
            })

            .then(() => {
              const assetsTasks = ctx.srcList.map((asset) => ({
                title: `Loading ${asset.source}`,
                task: () => {
                  if (asset.isSameUrlAsPage) {
                    const pathToFile = path.join(
                      filesFolderPath,
                      asset.sourcePath,
                    );
                    return fs.writeFile(pathToFile, html);
                  }
                  if (!asset.isCallable) {
                    // проверка на внешний хост
                    return;
                  }
                  return getAsset(asset, filesFolderPath);
                },
              }));
              const listr = new Listr(assetsTasks, { concurrent: true });
              return listr.run();
            });
        },
      },
      {
        title: "Preparing final html",
        task: (ctx, task) => {
          log("Preparing the final HTML");
          const { html, srcList, filesFolderName, filepath } = ctx;
          const newHtml = replaceSrc(html, srcList, filesFolderName);
          return fs
            .writeFile(filepath, newHtml)

            .catch(() => {
              const message = "Saving final html error";
              log(message);
              task.title = message;
              throw new Error(message);
            })
            .then(() => {
              return `Saved to ${filepath}`;
            });
        },
      },
    ],
    { renderer: process.env.NODE_ENV === "test" ? "silent" : "default" },
  );

  return tasks;
};

export default (...params) => createTasks(...params).run();
