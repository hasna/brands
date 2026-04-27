#!/usr/bin/env bun
import { Command } from "commander";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerListCommand } from "./commands/list.js";
import { registerExportCommand } from "./commands/export.js";
import { registerImportCommand } from "./commands/import.js";
import { registerBrandCommand } from "./commands/brand.js";
import { registerSvgCommand } from "./commands/svg.js";
import { registerTrainCommand } from "./commands/train.js";
import { registerShowCommand } from "./commands/show.js";
import { registerExtractCommand } from "./commands/extract.js";
import { registerBrandKitCommand } from "./commands/brand-kit.js";

const program = new Command()
  .name("brands")
  .description("AI-powered brand identity toolkit — generate logos, color palettes, and export production-ready assets")
  .version("0.0.1");

registerGenerateCommand(program);
registerListCommand(program);
registerShowCommand(program);
registerExportCommand(program);
registerImportCommand(program);
registerBrandCommand(program);
registerSvgCommand(program);
registerTrainCommand(program);
registerExtractCommand(program);
registerBrandKitCommand(program);

program.parse();
