import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { getDb, closeDb, resetDb } from "./database.js";
import { createGeneration, completeGeneration, failGeneration, listGenerations } from "./generations.js";
import { createLogo } from "./logos.js";

describe("generations", () => {
  beforeEach(() => {
    resetDb();
    process.env["BRANDS_DB_PATH"] = ":memory:";
    getDb();
  });

  afterEach(() => {
    closeDb();
    delete process.env["BRANDS_DB_PATH"];
  });

  test("create generation", () => {
    const gen = createGeneration({
      provider: "openai",
      model: "gpt-image-2",
      prompt: "a test logo",
    });

    expect(gen.status).toBe("running");
    expect(gen.provider).toBe("openai");
  });

  test("complete generation", () => {
    const gen = createGeneration({
      provider: "quiver",
      model: "arrow-1.1",
      prompt: "test",
    });

    const logo = createLogo({ name: "Test", provider: "quiver", model: "arrow-1.1", filePath: "/tmp/t.svg" });
    completeGeneration(gen.id, logo.id, 5);

    const gens = listGenerations({ status: "completed" });
    expect(gens.length).toBe(1);
    expect(gens[0]!.creditsUsed).toBe(5);
  });

  test("fail generation", () => {
    const gen = createGeneration({
      provider: "bfl",
      model: "flux.2-pro",
      prompt: "test",
    });

    failGeneration(gen.id, "API timeout");

    const gens = listGenerations({ status: "failed" });
    expect(gens.length).toBe(1);
    expect(gens[0]!.error).toBe("API timeout");
  });

  test("list with filters", () => {
    createGeneration({ provider: "openai", model: "gpt-image-2", prompt: "a" });
    createGeneration({ provider: "gemini", model: "gemini-3.1", prompt: "b" });

    expect(listGenerations().length).toBe(2);
    expect(listGenerations({ provider: "openai" }).length).toBe(1);
  });
});
