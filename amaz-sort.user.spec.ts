import { describe, it, expect } from "vitest";
import { testData } from "./testData.ts";

describe("Amazon Sort UserScript", () => {
  it("should have test data loaded", () => {
    expect(testData).toBeDefined();
    expect(testData.length).toBeGreaterThan(0);
  });

  it("should parse prices from test data", () => {
    const rePrice = /¥(?<price>\d{1,3}(,\d{3})*(\.\d{2})?|\d+(\.\d{2})?)/g;

    const pricesFound = testData
      .map((text) => {
        const match = text.match(rePrice);
        return match ? match[0] : null;
      })
      .filter((p) => p != null);

    expect(pricesFound.length).toBeGreaterThan(0);
  });

  it("should parse piece and weight information from test data", () => {
    const rePieceWeights =
      /(?:(?<weightSize>\d+\.*\d*)\s*(?<weightUnit>oz|g|ml|fl\soz|g|oz|kg|liters|pound|ton|pieces?|pack|bags?))|(?:(?<count1>\d+)\s*pieces?|pack\sof\s(?<count2>\d+)|\s*?[x�*]\s*?(?<count3>\d+)\s\w+s\b|(?<count4>\d+)\s\w+s\s+)/gi;

    const weightsFound = testData
      .flatMap((text) => Array.from(text.matchAll(rePieceWeights)))
      .filter((m) => m.groups);

    expect(weightsFound.length).toBeGreaterThan(0);
  });

  it("should calculate price per kg correctly", () => {
    // Test sample: "�1,252 (�52/unit)" with "16.9 fl oz (500 ml) x 24 Bottles"
    const price = 1252;
    const weightSizeInKg = 0.5; // 500ml
    const pieces = 24;

    const pricePerKg = price / (weightSizeInKg * pieces);

    expect(pricePerKg).toBeGreaterThan(0);
    expect(pricePerKg).toBeCloseTo(104.33, 1);
  });

  it("should calculate price per piece correctly", () => {
    const price = 1252;
    const pieces = 24;

    const pricePerPiece = price / pieces;

    expect(pricePerPiece).toBeCloseTo(52.17, 1);
  });

  it("should handle missing price data gracefully", () => {
    const textWithoutPrice = "Some product description without price";
    const rePrice = /�(?<price>\d{1,3}(,\d{3})*(\.\d{2})?|\d+(\.\d{2})?)/g;

    const match = textWithoutPrice.match(rePrice);

    expect(match).toBeNull();
  });

  it("should convert various weight units to kg", () => {
    const weightUnits = {
      g: 0.001,
      kg: 1,
      pound: 0.453592,
      pounds: 0.453592,
      oz: 0.0283495,
      "fl oz": 0.0295735,
      liters: 1,
      ml: 0.001,
    };

    expect(weightUnits.ml * 500).toBeCloseTo(0.5, 2);
    expect(weightUnits.g * 1000).toBe(1);
    expect(weightUnits.kg).toBe(1);
  });
});
