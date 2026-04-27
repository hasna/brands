import { Command } from "commander";
import chalk from "chalk";
import { importFromFile, importFromUrl } from "../../lib/library.js";

export function registerImportCommand(program: Command): void {
  program
    .command("import")
    .description("Import a logo from a file or URL")
    .argument("<source>", "File path or URL")
    .option("-n, --name <name>", "Name for the imported logo")
    .option("-b, --brand <id>", "Associate with a brand")
    .action(async (source, opts) => {
      try {
        const isUrl = source.startsWith("http://") || source.startsWith("https://");

        console.log(chalk.blue(`Importing from ${isUrl ? "URL" : "file"}...`));

        const logo = isUrl
          ? await importFromUrl(source, { name: opts.name, brandId: opts.brand })
          : await importFromFile(source, { name: opts.name, brandId: opts.brand });

        console.log(chalk.green(`✓ Imported: ${logo.name}`));
        console.log(`  Format:  ${logo.format}`);
        console.log(`  Path:    ${chalk.dim(logo.filePath)}`);
        console.log(`  ID:      ${chalk.dim(logo.id)}`);
      } catch (err) {
        console.error(chalk.red(`Import failed: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
