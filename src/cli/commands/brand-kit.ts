import { Command } from "commander";
import chalk from "chalk";
import { generateVariants, selectLogo, getSelectedLogo, buildBrandKit } from "../../lib/brand-kit.js";
import { getBrand } from "../../db/brands.js";
import { getLogo } from "../../db/logos.js";

export function registerBrandKitCommand(program: Command): void {
  const kit = program
    .command("brand-kit")
    .alias("kit")
    .description("Generate complete brand identity kits");

  kit
    .command("generate")
    .description("Generate logo variants for a brand")
    .argument("<brand>", "Brand ID or slug")
    .argument("<prompt>", "Logo description")
    .option("--variants <count>", "Number of variants (default: 4)")
    .option("-i, --instructions <text>", "Style instructions")
    .option("--ref <path>", "Reference image to base variants on")
    .action(async (brandId, prompt, opts) => {
      const brand = getBrand(brandId);
      if (!brand) {
        console.error(chalk.red(`Brand not found: ${brandId}`));
        process.exit(1);
      }

      const count = parseInt(opts.variants || "4", 10);
      console.log(chalk.blue(`Generating ${count} logo variants for ${brand.name}${opts.ref ? " (with reference)" : ""}...\n`));

      const logos = await generateVariants(brand.id, prompt, count, opts.instructions, opts.ref);

      console.log(chalk.green(`\n✓ ${logos.length} variants generated:\n`));
      for (const logo of logos) {
        console.log(`  ${chalk.dim(logo.id)}  ${logo.name}  ${chalk.dim(logo.filePath)}`);
      }

      console.log(chalk.yellow(`\nReview the images, then run:`));
      console.log(chalk.cyan(`  brands brand-kit select ${brand.slug} <logo-id>`));
    });

  kit
    .command("select")
    .description("Select the primary logo for a brand")
    .argument("<brand>", "Brand ID or slug")
    .argument("<logo-id>", "Logo ID to use")
    .action((brandId, logoId) => {
      const brand = getBrand(brandId);
      if (!brand) {
        console.error(chalk.red(`Brand not found: ${brandId}`));
        process.exit(1);
      }
      const logo = getLogo(logoId);
      if (!logo) {
        console.error(chalk.red(`Logo not found: ${logoId}`));
        process.exit(1);
      }

      selectLogo(brand.id, logoId);
      console.log(chalk.green(`✓ Selected "${logo.name}" as primary logo for ${brand.name}`));
      console.log(chalk.yellow(`\nNow run:`));
      console.log(chalk.cyan(`  brands brand-kit build ${brand.slug}`));
    });

  kit
    .command("build")
    .description("Build the full brand kit from the selected logo")
    .argument("<brand>", "Brand ID or slug")
    .option("--logo <id>", "Override logo selection")
    .option("--name <name>", "Contact name for business cards")
    .option("--title <title>", "Job title for business cards")
    .option("--email <email>", "Email for business cards")
    .option("--phone <phone>", "Phone for business cards")
    .option("--website <url>", "Website for business cards")
    .option("--address <addr>", "Address for business cards")
    .option("--skip-cards", "Skip business card generation")
    .option("--skip-covers", "Skip social cover generation")
    .action(async (brandId, opts) => {
      const brand = getBrand(brandId);
      if (!brand) {
        console.error(chalk.red(`Brand not found: ${brandId}`));
        process.exit(1);
      }

      let logoId = opts.logo;
      if (!logoId) {
        const selected = getSelectedLogo(brand.id);
        if (!selected) {
          console.error(chalk.red("No logo selected. Run 'brands brand-kit select' first or pass --logo <id>"));
          process.exit(1);
        }
        logoId = selected.id;
      }

      const hasContact = opts.name || opts.email || opts.phone;

      console.log(chalk.blue(`Building brand kit for ${brand.name}...\n`));

      try {
        const result = await buildBrandKit({
          brandId: brand.id,
          logoId,
          contactInfo: hasContact
            ? {
                name: opts.name,
                title: opts.title,
                email: opts.email,
                phone: opts.phone,
                website: opts.website,
                address: opts.address,
              }
            : undefined,
          skipBusinessCards: opts.skipCards || !hasContact,
          skipSocialCovers: opts.skipCovers,
        });

        console.log(chalk.green(`\n✓ Brand kit built: ${result.files.length} files`));
        console.log(chalk.dim(`  ${result.outputDir}\n`));

        const categories = new Map<string, number>();
        for (const f of result.files) {
          const rel = f.replace(result.outputDir + "/", "");
          const cat = rel.split("/").slice(0, 2).join("/");
          categories.set(cat, (categories.get(cat) || 0) + 1);
        }
        for (const [cat, count] of categories) {
          console.log(`  ${chalk.cyan(cat)}: ${count} files`);
        }

        if (result.errors.length) {
          console.log(chalk.yellow(`\n⚠ ${result.errors.length} warnings:`));
          for (const err of result.errors) {
            console.log(chalk.yellow(`  - ${err}`));
          }
        }
      } catch (err) {
        console.error(chalk.red(`Build failed: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
