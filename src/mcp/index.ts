#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { generate } from "../lib/generate.js";
import { exportLogo, getPresetSizes } from "../lib/export.js";
import { vectorizeLogo } from "../lib/svg.js";
import { importFromFile, importFromUrl } from "../lib/library.js";
import { createBrand, getBrand, listBrands, deleteBrand } from "../db/brands.js";
import { getLogo, listLogos } from "../db/logos.js";
import { listAssets } from "../db/assets.js";
import { createPalette, listPalettes } from "../db/palettes.js";
import { createTrainingSet, listTrainingSets } from "../lib/brains.js";
import { listGenerations } from "../db/generations.js";
import { extractBrandFromUrl, extractBrandFromScreenshot, extractBrandFromCssFile } from "../lib/styles.js";
import { generateVariants, selectLogo, buildBrandKit } from "../lib/brand-kit.js";
import type { Provider, LogoSource } from "../types/index.js";

const server = new Server(
  { name: "brands", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_logo",
      description: "Generate a logo using AI (OpenAI GPT-Image-2, Gemini Nano Banana 2, BFL FLUX.2, or Quiver Arrow-1.1)",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Description of the logo to generate" },
          provider: { type: "string", enum: ["openai", "gemini", "bfl", "quiver"], description: "AI provider" },
          model: { type: "string", description: "Model override" },
          instructions: { type: "string", description: "Style instructions" },
          name: { type: "string", description: "Name for the logo" },
          brand_id: { type: "string", description: "Associate with a brand" },
          svg: { type: "boolean", description: "Generate SVG output" },
          width: { type: "number", description: "Width in pixels" },
          height: { type: "number", description: "Height in pixels" },
        },
        required: ["prompt"],
      },
    },
    {
      name: "list_logos",
      description: "List all generated/imported logos",
      inputSchema: {
        type: "object",
        properties: {
          brand_id: { type: "string" },
          provider: { type: "string", enum: ["openai", "gemini", "bfl", "quiver"] },
          source: { type: "string", enum: ["generated", "imported", "vectorized"] },
        },
      },
    },
    {
      name: "get_logo",
      description: "Get details for a specific logo",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "export_logo",
      description: "Export a logo in multiple sizes (favicon, social, app, shortcut, all)",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Logo ID" },
          preset: { type: "string", enum: ["favicon", "social", "app", "shortcut", "all"], description: "Export preset" },
        },
        required: ["id"],
      },
    },
    {
      name: "vectorize_logo",
      description: "Convert a raster logo to SVG using Quiver or Gemini",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Logo ID" },
          method: { type: "string", enum: ["quiver", "gemini"] },
        },
        required: ["id"],
      },
    },
    {
      name: "import_logo",
      description: "Import a logo from a file path or URL",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", description: "File path or URL" },
          name: { type: "string" },
          brand_id: { type: "string" },
        },
        required: ["source"],
      },
    },
    {
      name: "create_brand",
      description: "Create a new brand identity",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          primary_color: { type: "string", description: "Hex color" },
          secondary_color: { type: "string" },
          accent_color: { type: "string" },
          font_primary: { type: "string" },
          font_secondary: { type: "string" },
        },
        required: ["name"],
      },
    },
    {
      name: "list_brands",
      description: "List all brands",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_brand",
      description: "Get brand details including logos and palettes",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Brand ID or slug" } },
        required: ["id"],
      },
    },
    {
      name: "delete_brand",
      description: "Delete a brand",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "add_palette",
      description: "Add a color palette to a brand",
      inputSchema: {
        type: "object",
        properties: {
          brand_id: { type: "string" },
          name: { type: "string" },
          colors: { type: "array", items: { type: "string" }, description: "Array of hex colors" },
        },
        required: ["brand_id", "name", "colors"],
      },
    },
    {
      name: "create_training_set",
      description: "Create a training dataset from logos for fine-tuning (integrates with open-brains)",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          logo_ids: { type: "array", items: { type: "string" } },
          provider: { type: "string", description: "Training provider (default: bfl)" },
        },
        required: ["name", "logo_ids"],
      },
    },
    {
      name: "list_training_sets",
      description: "List all training sets",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_generations",
      description: "List generation history",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "running", "completed", "failed"] },
          provider: { type: "string", enum: ["openai", "gemini", "bfl", "quiver"] },
        },
      },
    },
    {
      name: "extract_brand_from_url",
      description: "Extract brand identity (colors, fonts, spacing) from a website URL using @hasna/styles",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to extract brand identity from" },
          name: { type: "string", description: "Brand name (auto-detected if omitted)" },
          pages: { type: "number", description: "Number of pages to scrape (default: 3)" },
        },
        required: ["url"],
      },
    },
    {
      name: "extract_brand_from_screenshot",
      description: "Extract brand identity from a screenshot image using AI vision",
      inputSchema: {
        type: "object",
        properties: {
          image_path: { type: "string", description: "Path to screenshot image" },
          name: { type: "string", description: "Brand name" },
        },
        required: ["image_path"],
      },
    },
    {
      name: "extract_brand_from_css",
      description: "Extract brand identity from a CSS/SCSS file",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path to CSS/SCSS file" },
          name: { type: "string", description: "Brand name" },
        },
        required: ["file_path"],
      },
    },
    {
      name: "brand_kit_generate_variants",
      description: "Generate N logo variants for a brand to choose from",
      inputSchema: {
        type: "object",
        properties: {
          brand_id: { type: "string", description: "Brand ID or slug" },
          prompt: { type: "string", description: "Logo description" },
          variants: { type: "number", description: "Number of variants (default: 4)" },
          instructions: { type: "string", description: "Style instructions" },
        },
        required: ["brand_id", "prompt"],
      },
    },
    {
      name: "brand_kit_select_logo",
      description: "Select the primary logo for a brand kit",
      inputSchema: {
        type: "object",
        properties: {
          brand_id: { type: "string" },
          logo_id: { type: "string" },
        },
        required: ["brand_id", "logo_id"],
      },
    },
    {
      name: "brand_kit_build",
      description: "Build a complete brand kit: color variants (black/white/color), SVGs, social avatars, covers, favicons, app icons, shortcut icons, and business cards",
      inputSchema: {
        type: "object",
        properties: {
          brand_id: { type: "string" },
          logo_id: { type: "string", description: "Override logo (uses selected if omitted)" },
          contact_name: { type: "string" },
          contact_title: { type: "string" },
          contact_email: { type: "string" },
          contact_phone: { type: "string" },
          contact_website: { type: "string" },
          contact_address: { type: "string" },
          skip_cards: { type: "boolean" },
          skip_covers: { type: "boolean" },
        },
        required: ["brand_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "generate_logo": {
        const logo = await generate({
          prompt: args!["prompt"] as string,
          provider: args?.["provider"] as Provider | undefined,
          model: args?.["model"] as string | undefined,
          instructions: args?.["instructions"] as string | undefined,
          name: args?.["name"] as string | undefined,
          brandId: args?.["brand_id"] as string | undefined,
          svg: args?.["svg"] as boolean | undefined,
          width: args?.["width"] as number | undefined,
          height: args?.["height"] as number | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(logo, null, 2) }] };
      }

      case "list_logos": {
        const logos = listLogos({
          brandId: args?.["brand_id"] as string | undefined,
          provider: args?.["provider"] as Provider | undefined,
          source: args?.["source"] as LogoSource | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(logos, null, 2) }] };
      }

      case "get_logo": {
        const logo = getLogo(args!["id"] as string);
        if (!logo) return { content: [{ type: "text", text: "Logo not found" }], isError: true };
        const assets = listAssets(logo.id);
        return { content: [{ type: "text", text: JSON.stringify({ ...logo, assets }, null, 2) }] };
      }

      case "export_logo": {
        const logo = getLogo(args!["id"] as string);
        if (!logo) return { content: [{ type: "text", text: "Logo not found" }], isError: true };
        const sizes = getPresetSizes((args?.["preset"] as string) || "favicon");
        const assets = await exportLogo(logo, sizes);
        return { content: [{ type: "text", text: JSON.stringify(assets, null, 2) }] };
      }

      case "vectorize_logo": {
        const logo = getLogo(args!["id"] as string);
        if (!logo) return { content: [{ type: "text", text: "Logo not found" }], isError: true };
        const svgPath = await vectorizeLogo(logo, (args?.["method"] as "quiver" | "gemini") || "quiver");
        return { content: [{ type: "text", text: JSON.stringify({ svgPath }, null, 2) }] };
      }

      case "import_logo": {
        const source = args!["source"] as string;
        const isUrl = source.startsWith("http://") || source.startsWith("https://");
        const logo = isUrl
          ? await importFromUrl(source, { name: args?.["name"] as string, brandId: args?.["brand_id"] as string })
          : await importFromFile(source, { name: args?.["name"] as string, brandId: args?.["brand_id"] as string });
        return { content: [{ type: "text", text: JSON.stringify(logo, null, 2) }] };
      }

      case "create_brand": {
        const brand = createBrand({
          name: args!["name"] as string,
          description: args?.["description"] as string | undefined,
          primaryColor: args?.["primary_color"] as string | undefined,
          secondaryColor: args?.["secondary_color"] as string | undefined,
          accentColor: args?.["accent_color"] as string | undefined,
          fontPrimary: args?.["font_primary"] as string | undefined,
          fontSecondary: args?.["font_secondary"] as string | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(brand, null, 2) }] };
      }

      case "list_brands": {
        const brands = listBrands();
        return { content: [{ type: "text", text: JSON.stringify(brands, null, 2) }] };
      }

      case "get_brand": {
        const brand = getBrand(args!["id"] as string);
        if (!brand) return { content: [{ type: "text", text: "Brand not found" }], isError: true };
        const logos = listLogos({ brandId: brand.id });
        const palettes = listPalettes(brand.id);
        return { content: [{ type: "text", text: JSON.stringify({ ...brand, logos, palettes }, null, 2) }] };
      }

      case "delete_brand": {
        deleteBrand(args!["id"] as string);
        return { content: [{ type: "text", text: "Brand deleted" }] };
      }

      case "add_palette": {
        const palette = createPalette({
          brandId: args!["brand_id"] as string,
          name: args!["name"] as string,
          colors: args!["colors"] as string[],
        });
        return { content: [{ type: "text", text: JSON.stringify(palette, null, 2) }] };
      }

      case "create_training_set": {
        const ts = createTrainingSet({
          name: args!["name"] as string,
          logoIds: args!["logo_ids"] as string[],
          provider: args?.["provider"] as string | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(ts, null, 2) }] };
      }

      case "list_training_sets": {
        const sets = listTrainingSets();
        return { content: [{ type: "text", text: JSON.stringify(sets, null, 2) }] };
      }

      case "list_generations": {
        const gens = listGenerations({
          status: args?.["status"] as "pending" | "running" | "completed" | "failed" | undefined,
          provider: args?.["provider"] as Provider | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(gens, null, 2) }] };
      }

      case "extract_brand_from_url": {
        const result = await extractBrandFromUrl(
          args!["url"] as string,
          { name: args?.["name"] as string | undefined, pages: args?.["pages"] as number | undefined },
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "extract_brand_from_screenshot": {
        const result = await extractBrandFromScreenshot(
          args!["image_path"] as string,
          { name: args?.["name"] as string | undefined },
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "extract_brand_from_css": {
        const result = await extractBrandFromCssFile(
          args!["file_path"] as string,
          { name: args?.["name"] as string | undefined },
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "brand_kit_generate_variants": {
        const logos = await generateVariants(
          args!["brand_id"] as string,
          args!["prompt"] as string,
          (args?.["variants"] as number) || 4,
          args?.["instructions"] as string | undefined,
        );
        return { content: [{ type: "text", text: JSON.stringify(logos, null, 2) }] };
      }

      case "brand_kit_select_logo": {
        selectLogo(args!["brand_id"] as string, args!["logo_id"] as string);
        return { content: [{ type: "text", text: "Logo selected as primary" }] };
      }

      case "brand_kit_build": {
        const hasContact = args?.["contact_name"] || args?.["contact_email"];
        const result = await buildBrandKit({
          brandId: args!["brand_id"] as string,
          logoId: args?.["logo_id"] as string || "",
          contactInfo: hasContact ? {
            name: args?.["contact_name"] as string,
            title: args?.["contact_title"] as string,
            email: args?.["contact_email"] as string,
            phone: args?.["contact_phone"] as string,
            website: args?.["contact_website"] as string,
            address: args?.["contact_address"] as string,
          } : undefined,
          skipBusinessCards: (args?.["skip_cards"] as boolean) || !hasContact,
          skipSocialCovers: args?.["skip_covers"] as boolean,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
