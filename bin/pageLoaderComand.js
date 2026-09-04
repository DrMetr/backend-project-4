#!/usr/bin/env node
import pageLoader from "../src/pageLoader.js";
import { Command } from "commander";

const program = new Command();
program
  .name("page-loader")
  .version("1.0.0")
  .description("Page loader utility")
  .argument("<url>", "url to the page to be downloaded")
  .option("-o, --output <dir>", "where to store the page")
  .action((url) => {
    const folder = program.opts().output;
    pageLoader(url, folder).catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
  });

program.parse();
