import * as cheerio from "cheerio";
import path from "node:path";

export default (html, additionalFiles, folderName) => {
  const $ = cheerio.load(html);
  const images = additionalFiles.filter((item) => item.type === "img");
  const links = additionalFiles.filter((item) => item.type === "link");
  const scripts = additionalFiles.filter((item) => item.type === "script");

  const replace = ({ type, sourcePath, isCallable }, index) => {
    const attribute = type === "link" ? "href" : "src";
    if (type === "link" && $(type).eq(index).attr("rel") === "canonical") {
      $(type)
        .eq(index)
        .attr("href", () => {
          return path.join(folderName, folderName.replace("_files", ".html"));
        });
      return;
    }

    $(type)
      .eq(index)
      .attr(attribute, () => {
        if (!isCallable) return sourcePath;
        return path.join(folderName, sourcePath);
      });
  };

  images.forEach(replace);
  links.forEach(replace);
  scripts.forEach(replace);

  return $.html();
};
