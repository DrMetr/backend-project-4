import * as cheerio from "cheerio";

const getScripts = (html) => {
  const $ = cheerio.load(html);
  return $("body")
    .find("script")
    .map((_index, item) => $(item).attr("src"))
    .get();
};

const getLinks = (html) => {
  const $ = cheerio.load(html);
  return $("head")
    .find("link")
    .map((_index, item) => {
      return $(item).attr("href");
    })
    .get();
};

const getImages = (html) => {
  const $ = cheerio.load(html);
  return $("body")
    .find("img")
    .map((_index, item) => $(item).attr("src"))
    .get();
};

export { getImages, getLinks, getScripts };
