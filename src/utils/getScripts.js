import * as cheerio from "cheerio";

export default (html) => {
  const $ = cheerio.load(html);
  return $("body")
    .find("script")
    .map((_index, item) => $(item).attr("src"))
    .get();
};
