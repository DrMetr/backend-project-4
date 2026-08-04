import * as cheerio from "cheerio";
import path from "node:path";

//ОТРЕФРАКТОРИТЬ ЖОСКА!!!!

export default (html, additionalFiles, folderName) => {
  const $ = cheerio.load(html);
  const images = additionalFiles.filter((item) => item.type === "img");
  const links = additionalFiles.filter((item) => item.type === "link");
  const scripts = additionalFiles.filter((item) => item.type === "script");

  $("img").each((index, el) =>
    $(el).attr("src", () => {
      const { isCallable, sourcePath } = images[index];
      if (!isCallable) return sourcePath;
      return path.join(folderName, sourcePath);
    }),
  );
  $("link").each((index, el) =>
    $(el).attr("href", () => {
      const { isCallable, sourcePath } = links[index];
      if ($(el).attr("rel") === "canonical")
        return path.join(folderName, folderName.replace("_files", ".html"));
      if (!isCallable) return sourcePath;
      return path.join(folderName, sourcePath);
    }),
  );
  $("script").each((index, el) =>
    $(el).attr("src", () => {
      const { isCallable, sourcePath } = scripts[index];
      if (!isCallable) return sourcePath;
      return path.join(folderName, sourcePath);
    }),
  );
  return $.html();
};
