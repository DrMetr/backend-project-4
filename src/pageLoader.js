import Listr from "listr";
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

const createTasks = ({ folder, url }) => {
  const log = debug("page-loader");

  log("Logging is on");
  return new Listr([
    {
      title: "Checking if url is specified",
      task: (ctx, task) => {
        if (!url) {
          log("No url");
          task.title("No URL");
          throw new Error();
        }
        task.title = "URL OK";
      },
    },
    {
      title: "Checking if an output is specified",
      task: (ctx, task) => {
        if (!folder) {
          log("No directory specified");
          task.title("No directory specified");
          throw new Error();
        } else {
          task.title = "Output directory specified";
          log("Output directory specified");
          return;
        }
      },
    },
    {
      title: "Checking if the output is accessible",
      task: (ctx, task) => {
        return checkFolderAccessibility(folder)
          .then(() => {
            task.title = "Output directory is accessible";
            log("Output directory is accessible");
          })
          .catch((err) => {
            log(`Directory inaccessible`);
            task.title(`Directory inaccessible`);
            throw err;
          });
      },
    },
    {
      title: "Requesting the page",
      task: (ctx, task) =>
        makeRequest(url)
          .catch((e) => {
            log(`Error requesting page: ${e}`);
            throw e;
          })
          .then((data) => {
            log("Page request fulfilled");
            task.title = "Page request fulfilled";
            const { filepath, filesFolderName, host, prefix, filesFolderPath } =
              getInfo(folder, url);
            ctx.html = data;
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
      title: "Requesting additional assets",
      task: (ctx, task) => {
        log("Requesting additional assets");
        const { host, prefix, html, filesFolderPath } = ctx;
        ctx.srcList = makeSrcList(html, host, url, prefix);
        const srcListPromises = ctx.srcList.map((item) => {
          const { source, isCallable } = item;
          if (isCallable) {
            return makeRequest(new URL(source, url).toString()).catch((err) => {
              log(`Error loading ${url}`);
              task.title = "Additional resources error";
              throw err;
            });
          }
          return source;
        });
        return fs
          .mkdir(filesFolderPath, { recursive: true })
          .then(() => Promise.all(srcListPromises))
          .then((data) => {
            log(`Assets ready`);
            task.title = `Assets ready`;
            ctx.assets = data;
          });
      },
    },
    {
      title: "Saving assets to a designated folder",
      task: (ctx, task) => {
        const { srcList, filesFolderName, assets } = ctx;
        const createFilesPromises = srcList.map((_, index) => {
          const filePath = srcList[index].sourcePath;
          if (srcList[index].isCallable) {
            return fs.writeFile(
              path.resolve(folder, filesFolderName, filePath),
              assets[index],
            );
          }
          return null;
        });
        return Promise.all(createFilesPromises)
          .catch((err) => {
            log(`Saving assets error`);
            task.title = `Saving assets error`;
            throw err;
          })
          .then(() => {
            log(`Assets saved to ${ctx.filesFolderPath}`);
            task.title = `Assets saved to ${ctx.filesFolderPath}`;
          });
      },
    },
    {
      title: "Preparing final html",
      task: (ctx, task) => {
        log("Preparing the final HTML");
        const { html, srcList, filesFolderName, filepath } = ctx;
        const newHtml = replaceSrc(html, srcList, filesFolderName);
        return fs.writeFile(filepath, newHtml).catch((err) => {
          log(`Saving final html error`);
          task.title = `Saving final html error`;
          throw err;
        });
      },
    },
  ]);
};

export default createTasks;
