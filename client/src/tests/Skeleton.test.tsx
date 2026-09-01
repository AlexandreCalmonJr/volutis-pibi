import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, CardSkeleton, TableSkeleton } from "../components/Skeleton";

describe("Skeleton Components", () => {
  it("renders basic skeleton with custom class", () => {
    const { container } = render(<Skeleton className="w-20 h-4" />);
    expect(container.firstChild).toHaveClass("animate-pulse");
    expect(container.firstChild).toHaveClass("w-20");
  });

  it("renders card skeleton with placeholder lines", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders table skeleton with specified rows and cols", () => {
    const { container } = render(<TableSkeleton rows={4} cols={3} />);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(12);
  });
});
