import { Command } from "commander";
import chalk from "chalk";
import { createTrainingSet, getTrainingSet, listTrainingSets } from "../../lib/brains.js";

export function registerTrainCommand(program: Command): void {
  const train = program
    .command("train")
    .description("Manage model training via open-brains");

  train
    .command("create")
    .description("Create a training set from logos")
    .argument("<name>", "Training set name")
    .requiredOption("--logos <ids>", "Comma-separated logo IDs")
    .option("-p, --provider <provider>", "Training provider", "bfl")
    .action((name, opts) => {
      try {
        const logoIds = opts.logos.split(",").map((s: string) => s.trim());
        const ts = createTrainingSet({ name, logoIds, provider: opts.provider });

        console.log(chalk.green(`✓ Training set created: ${ts.name}`));
        console.log(`  ID:     ${chalk.dim(ts.id)}`);
        console.log(`  Logos:  ${ts.logoIds.length}`);
        console.log(`  Status: ${ts.status}`);
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  train
    .command("list")
    .description("List training sets")
    .action(() => {
      const sets = listTrainingSets();
      if (sets.length === 0) {
        console.log(chalk.dim("No training sets found."));
        return;
      }
      for (const ts of sets) {
        const date = new Date(ts.createdAt).toLocaleDateString();
        console.log(
          `  ${chalk.dim(ts.id.slice(0, 8))}  ${ts.name}  ${ts.provider}  ${chalk.cyan(ts.status)}  ${ts.logoIds.length} logos  ${chalk.dim(date)}`
        );
      }
    });

  train
    .command("status")
    .description("Check training set status")
    .argument("<id>", "Training set ID")
    .action((id) => {
      const ts = getTrainingSet(id);
      if (!ts) {
        console.error(chalk.red(`Training set not found: ${id}`));
        process.exit(1);
      }

      console.log(chalk.bold(ts.name));
      console.log(`  ID:       ${ts.id}`);
      console.log(`  Provider: ${ts.provider}`);
      console.log(`  Status:   ${chalk.cyan(ts.status)}`);
      console.log(`  Logos:    ${ts.logoIds.length}`);
      if (ts.brainsModelId) {
        console.log(`  Model:    ${ts.brainsModelId}`);
      }
    });
}
