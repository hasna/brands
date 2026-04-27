import { Command } from "commander";
import chalk from "chalk";
import { getLogo } from "../../db/logos.js";
import { vectorizeLogo } from "../../lib/svg.js";

export function registerSvgCommand(program: Command): void {
  program
    .command("svg")
    .description("Generate or convert SVG for a logo")
    .argument("<id>", "Logo ID")
    .option("-m, --method <method>", "Vectorization method (quiver, gemini)", "quiver")
    .action(async (id, opts) => {
      const logo = getLogo(id);
      if (!logo) {
        console.error(chalk.red(`Logo not found: ${id}`));
        process.exit(1);
      }

      if (logo.svgPath) {
        console.log(chalk.yellow(`Logo already has SVG: ${logo.svgPath}`));
        console.log(chalk.dim("Regenerating..."));
      }

      try {
        const method = opts.method as "quiver" | "gemini";
        console.log(chalk.blue(`Vectorizing with ${method}...`));

        const svgPath = await vectorizeLogo(logo, method);

        console.log(chalk.green(`✓ SVG created: ${svgPath}`));
      } catch (err) {
        console.error(chalk.red(`SVG generation failed: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
