import Listr from "listr";
import debug from "debug";
import fs from "fs/promises";
import replaceSrc from "./utils/replaceSrc.js";
import {
  getInfo,
  makeRequest,
  makeSrcList,
  checkFolderAccessibility,
  getAsset,
} from "./utils/pageLoaderHelperFunctions.js";
import { cwd } from "node:process";
import axios from "axios";
import { addLogger } from "axios-debug-log";
import path from "node:path";

addLogger(axios);

const createTasks = ({ folder = cwd(), url }) => {
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
              return Promise.reject(new Error(message));
            });
        },
      },
      {
        title: "Requesting the page",
        task: (ctx, task) => {
          return makeRequest(url)
            .catch(() => {
              const message = `Invalid URL: ${url}`;
              log(message);
              task.title = message;
              return Promise.reject(new Error(message));
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
              console.log(`Saved to ${filepath}`);
            });
        },
      },
    ],
    { renderer: process.env.NODE_ENV === "test" ? "silent" : "default" },
  );

  return tasks;
};

export default (params) => createTasks(params).run();
