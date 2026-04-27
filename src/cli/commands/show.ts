import { Command } from "commander";
import chalk from "chalk";
import { getLogo } from "../../db/logos.js";
import { listAssets } from "../../db/assets.js";

export function registerShowCommand(program: Command): void {
  program
    .command("show")
    .description("Show details for a logo")
    .argument("<id>", "Logo ID")
    .action((id) => {
      const logo = getLogo(id);
      if (!logo) {
        console.error(chalk.red(`Logo not found: ${id}`));
        process.exit(1);
      }

      console.log(chalk.bold(logo.name));
      console.log(`  ID:           ${logo.id}`);
      console.log(`  Provider:     ${logo.provider}/${logo.model}`);
      console.log(`  Format:       ${logo.format}`);
      console.log(`  Source:        ${logo.source}`);
      if (logo.width && logo.height) {
        console.log(`  Dimensions:   ${logo.width}x${logo.height}`);
      }
      console.log(`  File:         ${chalk.dim(logo.filePath)}`);
      if (logo.svgPath) {
        console.log(`  SVG:          ${chalk.dim(logo.svgPath)}`);
      }
      if (logo.prompt) {
        console.log(`  Prompt:       ${logo.prompt}`);
      }
      if (logo.brandId) {
        console.log(`  Brand:        ${logo.brandId}`);
      }
      console.log(`  Created:      ${new Date(logo.createdAt).toLocaleString()}`);

      const assets = listAssets(logo.id);
      if (assets.length > 0) {
        console.log(chalk.bold(`\n  Exported assets (${assets.length}):`));
        for (const asset of assets) {
          console.log(`    ${asset.purpose}  ${asset.width}x${asset.height}  ${asset.format}  ${chalk.dim(asset.filePath)}`);
        }
      }
    });
}
