import * as cheerio from "cheerio";

export default (html) => {
  const $ = cheerio.load(html);
  return $("head")
    .find("link")
    .map((_index, item) => {
      return $(item).attr("href");
    })
    .get();
};
