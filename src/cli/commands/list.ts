import { Command } from "commander";
import chalk from "chalk";
import { listLogos } from "../../db/logos.js";
import type { Provider, LogoSource } from "../../types/index.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .alias("ls")
    .description("List all logos")
    .option("-b, --brand <id>", "Filter by brand ID")
    .option("-p, --provider <provider>", "Filter by provider")
    .option("-s, --source <source>", "Filter by source (generated, imported, vectorized)")
    .action((opts) => {
      const logos = listLogos({
        brandId: opts.brand,
        provider: opts.provider as Provider,
        source: opts.source as LogoSource,
      });

      if (logos.length === 0) {
        console.log(chalk.dim("No logos found."));
        return;
      }

      console.log(chalk.bold(`${logos.length} logo(s):\n`));
      for (const logo of logos) {
        const date = new Date(logo.createdAt).toLocaleDateString();
        const svg = logo.svgPath ? chalk.green(" [SVG]") : "";
        console.log(
          `  ${chalk.dim(logo.id.slice(0, 8))}  ${logo.name}  ${chalk.blue(logo.provider)}/${chalk.cyan(logo.model)}  ${logo.format}${svg}  ${chalk.dim(date)}`
        );
      }
    });
}
