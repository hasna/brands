import { Command } from "commander";
import chalk from "chalk";
import { createBrand, getBrand, listBrands, deleteBrand } from "../../db/brands.js";
import { listLogos } from "../../db/logos.js";
import { listPalettes, createPalette } from "../../db/palettes.js";
import { createContact, listContacts } from "../../db/contacts.js";
import { listKitRuns, markKitRunFinal, addKitRunNotes } from "../../db/kit-runs.js";

export function registerBrandCommand(program: Command): void {
  const brand = program
    .command("brand")
    .description("Manage brands");

  brand
    .command("create")
    .description("Create a new brand")
    .argument("<name>", "Brand name")
    .option("-d, --description <text>", "Description")
    .option("--primary <color>", "Primary color (hex)")
    .option("--secondary <color>", "Secondary color (hex)")
    .option("--accent <color>", "Accent color (hex)")
    .option("--font-primary <font>", "Primary font family")
    .option("--font-secondary <font>", "Secondary font family")
    .action((name, opts) => {
      const brand = createBrand({
        name,
        description: opts.description,
        primaryColor: opts.primary,
        secondaryColor: opts.secondary,
        accentColor: opts.accent,
        fontPrimary: opts.fontPrimary,
        fontSecondary: opts.fontSecondary,
      });

      console.log(chalk.green(`✓ Created brand: ${brand.name}`));
      console.log(`  Slug: ${brand.slug}`);
      console.log(`  ID:   ${chalk.dim(brand.id)}`);
    });

  brand
    .command("list")
    .description("List all brands")
    .action(() => {
      const brands = listBrands();
      if (brands.length === 0) {
        console.log(chalk.dim("No brands found."));
        return;
      }
      for (const b of brands) {
        const colors = [b.primaryColor, b.secondaryColor, b.accentColor].filter(Boolean);
        const colorStr = colors.length ? chalk.dim(` [${colors.join(", ")}]`) : "";
        console.log(`  ${chalk.dim(b.id.slice(0, 8))}  ${chalk.bold(b.name)}  ${chalk.cyan(b.slug)}${colorStr}`);
      }
    });

  brand
    .command("show")
    .description("Show brand details")
    .argument("<id>", "Brand ID or slug")
    .action((id) => {
      const b = getBrand(id);
      if (!b) {
        console.error(chalk.red(`Brand not found: ${id}`));
        process.exit(1);
      }

      console.log(chalk.bold(b.name));
      console.log(`  ID:          ${b.id}`);
      console.log(`  Slug:        ${b.slug}`);
      if (b.description) console.log(`  Description: ${b.description}`);
      if (b.primaryColor) console.log(`  Primary:     ${b.primaryColor}`);
      if (b.secondaryColor) console.log(`  Secondary:   ${b.secondaryColor}`);
      if (b.accentColor) console.log(`  Accent:      ${b.accentColor}`);
      if (b.fontPrimary) console.log(`  Font 1:      ${b.fontPrimary}`);
      if (b.fontSecondary) console.log(`  Font 2:      ${b.fontSecondary}`);

      const logos = listLogos({ brandId: b.id });
      if (logos.length) {
        console.log(chalk.bold(`\n  Logos (${logos.length}):`));
        for (const l of logos) {
          console.log(`    ${chalk.dim(l.id.slice(0, 8))}  ${l.name}  ${l.provider}  ${l.format}`);
        }
      }

      const palettes = listPalettes(b.id);
      if (palettes.length) {
        console.log(chalk.bold(`\n  Palettes (${palettes.length}):`));
        for (const p of palettes) {
          console.log(`    ${p.name}: ${p.colors.join(", ")}`);
        }
      }
    });

  brand
    .command("delete")
    .description("Delete a brand")
    .argument("<id>", "Brand ID or slug")
    .action((id) => {
      deleteBrand(id);
      console.log(chalk.green(`✓ Deleted brand: ${id}`));
    });

  brand
    .command("palette")
    .description("Add a color palette to a brand")
    .argument("<brand-id>", "Brand ID or slug")
    .argument("<name>", "Palette name")
    .argument("<colors...>", "Hex colors")
    .action((brandId, name, colors) => {
      const b = getBrand(brandId);
      if (!b) {
        console.error(chalk.red(`Brand not found: ${brandId}`));
        process.exit(1);
      }

      const palette = createPalette({ brandId: b.id, name, colors });
      console.log(chalk.green(`✓ Added palette "${palette.name}" to ${b.name}`));
      console.log(`  Colors: ${palette.colors.join(", ")}`);
    });

  brand
    .command("contact")
    .description("Set contact info for a brand (used in business cards)")
    .argument("<brand-id>", "Brand ID or slug")
    .option("--name <name>", "Contact name")
    .option("--title <title>", "Job title")
    .option("--email <email>", "Email")
    .option("--phone <phone>", "Phone")
    .option("--website <url>", "Website")
    .option("--address <addr>", "Address")
    .option("--twitter <handle>", "Twitter handle")
    .option("--linkedin <url>", "LinkedIn URL")
    .option("--instagram <handle>", "Instagram handle")
    .option("--github <handle>", "GitHub handle")
    .option("--tagline <text>", "Brand tagline")
    .action((brandId, opts) => {
      const b = getBrand(brandId);
      if (!b) {
        console.error(chalk.red(`Brand not found: ${brandId}`));
        process.exit(1);
      }

      const contact = createContact({
        brandId: b.id,
        name: opts.name, title: opts.title, email: opts.email,
        phone: opts.phone, website: opts.website, address: opts.address,
        socialTwitter: opts.twitter, socialLinkedin: opts.linkedin,
        socialInstagram: opts.instagram, socialGithub: opts.github,
        tagline: opts.tagline,
      });

      console.log(chalk.green(`✓ Contact set for ${b.name}`));
      const fields = [
        contact.name, contact.title, contact.email, contact.phone,
        contact.website, contact.tagline,
      ].filter(Boolean);
      for (const f of fields) console.log(`  ${f}`);
    });

  brand
    .command("contacts")
    .description("List contacts for a brand")
    .argument("<brand-id>", "Brand ID or slug")
    .action((brandId) => {
      const b = getBrand(brandId);
      if (!b) {
        console.error(chalk.red(`Brand not found: ${brandId}`));
        process.exit(1);
      }

      const contacts = listContacts(b.id);
      if (contacts.length === 0) {
        console.log(chalk.dim("No contacts set. Use 'brands brand contact <brand> --name ...' to add one."));
        return;
      }

      for (const c of contacts) {
        const def = c.isDefault ? chalk.green(" [default]") : "";
        console.log(`  ${chalk.dim(c.id.slice(0, 8))}${def}`);
        if (c.name) console.log(`    ${c.name}${c.title ? ` — ${c.title}` : ""}`);
        if (c.email) console.log(`    ${c.email}`);
        if (c.phone) console.log(`    ${c.phone}`);
        if (c.website) console.log(`    ${c.website}`);
        if (c.tagline) console.log(`    "${c.tagline}"`);
      }
    });

  brand
    .command("runs")
    .description("List brand kit build runs")
    .argument("<brand-id>", "Brand ID or slug")
    .action((brandId) => {
      const b = getBrand(brandId);
      if (!b) {
        console.error(chalk.red(`Brand not found: ${brandId}`));
        process.exit(1);
      }

      const runs = listKitRuns(b.id);
      if (runs.length === 0) {
        console.log(chalk.dim("No kit runs yet."));
        return;
      }

      for (const r of runs) {
        const date = new Date(r.createdAt).toLocaleString();
        const final = r.isFinal ? chalk.green(" ★ FINAL") : "";
        const status = r.status === "completed" ? chalk.green(r.status) : r.status === "failed" ? chalk.red(r.status) : chalk.yellow(r.status);
        console.log(`  ${chalk.dim(r.id.slice(0, 8))}  ${status}  ${r.fileCount} files  ${chalk.dim(date)}${final}`);
        if (r.notes) console.log(`    ${chalk.dim(r.notes)}`);
        console.log(`    ${chalk.dim(r.outputDir)}`);
      }
    });

  brand
    .command("finalize")
    .description("Mark a kit run as the final deliverable")
    .argument("<run-id>", "Kit run ID")
    .option("--notes <text>", "Notes for this deliverable")
    .action((runId, opts) => {
      markKitRunFinal(runId);
      if (opts.notes) addKitRunNotes(runId, opts.notes);
      console.log(chalk.green(`✓ Run ${runId.slice(0, 8)} marked as final deliverable`));
    });
}
