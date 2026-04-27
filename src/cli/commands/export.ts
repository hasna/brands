import { Command } from "commander";
import chalk from "chalk";
import { getLogo } from "../../db/logos.js";
import { exportLogo, getPresetSizes, PRESETS } from "../../lib/export.js";
import type { ImageFormat } from "../../types/index.js";

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("Export a logo in multiple sizes")
    .argument("<id>", "Logo ID")
    .option("--preset <name>", `Export preset (${Object.keys(PRESETS).join(", ")}, all)`, "favicon")
    .option("--size <WxH>", "Custom size (e.g. 128x128)")
    .option("--format <fmt>", "Output format (png, webp, jpg)", "png")
    .option("-o, --output <dir>", "Output directory")
    .action(async (id, opts) => {
      const logo = getLogo(id);
      if (!logo) {
        console.error(chalk.red(`Logo not found: ${id}`));
        process.exit(1);
      }

      if (logo.format === "svg" && !logo.filePath.endsWith(".svg")) {
        console.error(chalk.red("Cannot export SVG-only logos to raster. Generate a raster version first."));
        process.exit(1);
      }

      try {
        let sizes;
        if (opts.size) {
          const [w, h] = opts.size.split("x").map(Number);
          if (!w || !h) {
            console.error(chalk.red("Invalid size format. Use WxH (e.g. 128x128)"));
            process.exit(1);
          }
          sizes = [{ purpose: `custom-${w}x${h}`, width: w, height: h, format: (opts.format || "png") as ImageFormat }];
        } else {
          sizes = getPresetSizes(opts.preset);
        }

        console.log(chalk.blue(`Exporting ${sizes.length} variants...`));
        const assets = await exportLogo(logo, sizes, opts.output);

        for (const asset of assets) {
          console.log(chalk.green(`  ✓ ${asset.purpose}  ${asset.width}x${asset.height}  ${chalk.dim(asset.filePath)}`));
        }
        console.log(chalk.green(`\n${assets.length} assets exported`));
      } catch (err) {
        console.error(chalk.red(`Export failed: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
