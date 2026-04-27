import { Command } from "commander";
import chalk from "chalk";
import { extractBrandFromUrl, extractBrandFromScreenshot, extractBrandFromCssFile } from "../../lib/styles.js";

export function registerExtractCommand(program: Command): void {
  program
    .command("extract")
    .description("Extract brand identity from a URL, screenshot, or CSS file")
    .argument("<source>", "URL, image file path, or CSS file path")
    .option("-n, --name <name>", "Brand name")
    .option("--pages <n>", "Number of pages to scrape (URL mode)", parseInt)
    .action(async (source, opts) => {
      try {
        const isUrl = source.startsWith("http://") || source.startsWith("https://");
        const isCss = source.endsWith(".css") || source.endsWith(".scss");
        const isImage = /\.(png|jpg|jpeg|webp)$/i.test(source);

        let result;

        if (isUrl) {
          console.log(chalk.blue(`Extracting brand from URL: ${source}...`));
          result = await extractBrandFromUrl(source, { name: opts.name, pages: opts.pages });
        } else if (isImage) {
          console.log(chalk.blue(`Extracting brand from screenshot: ${source}...`));
          result = await extractBrandFromScreenshot(source, { name: opts.name });
        } else if (isCss) {
          console.log(chalk.blue(`Extracting brand from CSS: ${source}...`));
          result = await extractBrandFromCssFile(source, { name: opts.name });
        } else {
          console.error(chalk.red("Source must be a URL, image file (.png/.jpg/.webp), or CSS file (.css/.scss)"));
          process.exit(1);
        }

        console.log(chalk.green(`\n✓ Brand created: ${result.brand.name}`));
        console.log(`  ID:    ${chalk.dim(result.brand.id)}`);
        console.log(`  Slug:  ${result.brand.slug}`);

        if (result.colors.length) {
          console.log(chalk.bold(`\n  Colors (${result.colors.length}):`));
          console.log(`    ${result.colors.join("  ")}`);
        }

        if (result.fonts.length) {
          console.log(chalk.bold(`\n  Fonts:`));
          for (const f of result.fonts) console.log(`    ${f}`);
        }

        if (result.borderRadius.length) {
          console.log(chalk.bold(`\n  Border radius:`));
          console.log(`    ${result.borderRadius.join(", ")}`);
        }
      } catch (err) {
        console.error(chalk.red(`Extraction failed: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
