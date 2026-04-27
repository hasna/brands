import { Command } from "commander";
import chalk from "chalk";
import { generate, generateMultiProvider } from "../../lib/generate.js";
import type { Provider } from "../../types/index.js";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .alias("gen")
    .description("Generate a logo with AI")
    .argument("<prompt>", "Description of the logo to generate")
    .option("-p, --provider <provider>", "AI provider (openai, gemini, bfl, quiver)")
    .option("-m, --model <model>", "Model override")
    .option("--svg", "Generate SVG output (gemini or quiver)")
    .option("-n, --name <name>", "Name for the logo")
    .option("-b, --brand <id>", "Associate with a brand")
    .option("-w, --width <px>", "Width in pixels", parseInt)
    .option("-h, --height <px>", "Height in pixels", parseInt)
    .option("-i, --instructions <text>", "Style instructions")
    .option("--all", "Generate with all providers")
    .action(async (prompt, opts) => {
      try {
        if (opts.all) {
          console.log(chalk.blue("Generating with all providers..."));
          const logos = await generateMultiProvider({
            prompt,
            instructions: opts.instructions,
            name: opts.name,
            brandId: opts.brand,
            width: opts.width,
            height: opts.height,
            svg: opts.svg,
          });

          for (const logo of logos) {
            console.log(chalk.green(`✓ ${logo.provider}/${logo.model}`));
            console.log(`  ${chalk.dim(logo.filePath)}`);
          }
          console.log(chalk.green(`\n${logos.length} logos generated`));
          return;
        }

        const provider = (opts.provider as Provider) || (opts.svg ? "quiver" : undefined);
        console.log(chalk.blue(`Generating with ${provider || "default provider"}...`));

        const logo = await generate({
          prompt,
          provider,
          model: opts.model,
          instructions: opts.instructions,
          name: opts.name,
          brandId: opts.brand,
          width: opts.width,
          height: opts.height,
          svg: opts.svg,
        });

        console.log(chalk.green(`✓ Generated: ${logo.name}`));
        console.log(`  Provider: ${logo.provider}/${logo.model}`);
        console.log(`  Format:   ${logo.format}`);
        console.log(`  Path:     ${chalk.dim(logo.filePath)}`);
        console.log(`  ID:       ${chalk.dim(logo.id)}`);
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
