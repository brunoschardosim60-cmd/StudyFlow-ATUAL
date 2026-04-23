import { describe, expect, it } from "vitest";
import { generateRevisionDates } from "./studyData";

describe("generateRevisionDates", () => {
  it("calcula revisoes em dias corridos quando skipWeekends=false", () => {
    const result = generateRevisionDates("2026-04-03", false);
    expect(result).toEqual([
      "2026-04-04",
      "2026-04-06",
      "2026-04-10",
      "2026-04-17",
      "2026-05-03",
      "2026-06-02",
    ]);
  });

  it("calcula revisoes encadeadas e empurra fim de semana para proximo dia util", () => {
    const result = generateRevisionDates("2026-04-03", true);
    expect(result).toEqual([
      "2026-04-06",
      "2026-04-09",
      "2026-04-16",
      "2026-04-30",
      "2026-06-01",
      "2026-07-31",
    ]);
  });

  it("empurra para segunda quando a data cair no domingo", () => {
    const result = generateRevisionDates("2026-04-02", true);
    expect(result[0]).toBe("2026-04-03");
    expect(result[1]).toBe("2026-04-06");
  });
});
