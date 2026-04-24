import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("utils", () => {
  describe("cn", () => {
    it("merges multiple class names", () => {
      const result = cn("px-2", "py-2", "text-blue-600");
      expect(result).toContain("px-2");
      expect(result).toContain("py-2");
      expect(result).toContain("text-blue-600");
    });

    it("removes duplicate tailwind classes, keeping the last one", () => {
      const result = cn("px-2", "px-4");
      expect(result).toContain("px-4");
      expect(result).not.toContain("px-2");
    });

    it("handles conditional classes", () => {
      const isActive = true;
      const result = cn("px-2", isActive && "text-blue-600");
      expect(result).toContain("text-blue-600");
    });

    it("handles conditional false classes", () => {
      const isActive = false;
      const result = cn("px-2", isActive && "text-blue-600");
      expect(result).not.toContain("text-blue-600");
    });

    it("handles empty inputs", () => {
      const result = cn("");
      expect(result).toBe("");
    });

    it("merges complex tailwind utilities", () => {
      const result = cn(
        "bg-white",
        "p-4",
        "rounded-lg",
        "shadow-md",
        "hover:shadow-lg"
      );
      expect(result).toContain("bg-white");
      expect(result).toContain("rounded-lg");
      expect(result).toContain("shadow");
      expect(result).toContain("hover");
    });

    it("handles undefined and null", () => {
      const result = cn("px-2", undefined, null, "py-2");
      expect(result).toContain("px-2");
      expect(result).toContain("py-2");
    });
  });
});
