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
  .action((page) => {
    const output = program.opts().output;
    console.log(pageLoader(output, page));
  });

program.parse();
