import Listr from "listr";
import debug from "debug";
import fs from "fs/promises";
import replaceSrc from "./utils/replaceSrc.js";
import {
  getInfo,
  makeRequest,
  makeSrcList,
  checkFolderAccessibility,
  checkURL,
  getAsset,
} from "./utils/pageLoaderHelperFunctions.js";
import { cwd } from "node:process";

const createTasks = ({ folder, url }) => {
  const log = debug("page-loader");
  log("Logging is on");

  if (!folder) {
    folder = cwd();
  }

  if (!checkURL(url)) {
    log("Invalid URL");
    throw new Error("Invalid URL");
  }
  return new Listr([
    {
      title: "Checking if the output is accessible",
      task: (ctx, task) => {
        return checkFolderAccessibility(folder)
          .then(() => {
            task.title = "Output directory is accessible";
            log("Output directory is accessible");
          })
          .catch(() => {
            log("Folder inaccessible");
            task.title = "Folder inaccessible";
            throw new Error("Folder inaccessible");
          });
      },
    },
    {
      title: "Requesting the page",
      task: (ctx, task) =>
        makeRequest(url)
          .catch((err) => {
            log(`Page request error: ${err}`);
            task.title = "Page request error";
            throw new Error("Page request error");
          })
          .then((response) => {
            log("Page request fulfilled");
            task.title = "Page request fulfilled";
            const { filepath, filesFolderName, host, prefix, filesFolderPath } =
              getInfo(folder, url);
            ctx.html = response.data;
            Object.assign(ctx, {
              filepath,
              filesFolderName,
              host,
              prefix,
              filesFolderPath,
            });
          }),
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
                console.log(filesFolderPath);
                return getAsset(asset, filesFolderPath, () => {
                  const message = `Error saving ${asset.source}`;
                  log(message);
                  task.title = message;
                  throw new Error(message);
                });
              },
            }));
            const listr = new Listr(assetsTasks, { concurrent: true });
            return listr.run();
          })
          .then(async () => {
            const rd = await fs.readdir(filesFolderPath);
            console.log("RD: ", rd);
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
            log("Saving final html error");
            task.title = "Saving final html error";
            throw new Error("Saving final html error");
          })
          .then(() => {
            console.log(`Saved to ${filepath}`);
          });
      },
    },
  ]);
};

export default createTasks;
