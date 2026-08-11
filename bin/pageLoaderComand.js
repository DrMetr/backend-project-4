#!/usr/bin/env node
import createTasks from "../src/progress.js";
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
    const tasks = createTasks({ folder, url });
    console.log(
      tasks.run({ folder, url }).catch((err) => {
        console.error(err);
      }),
    );
  });

program.parse();

/*
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
*/
