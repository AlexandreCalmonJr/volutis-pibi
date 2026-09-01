import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Metronome } from "../components/Metronome";

describe("Metronome Component", () => {
  it("renders with initial BPM and controls", () => {
    render(<Metronome initialBpm={120} />);
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("BPM")).toBeInTheDocument();
    expect(screen.getByText(/Tap Tempo/i)).toBeInTheDocument();
    expect(screen.getByText(/Iniciar Metrônomo/i)).toBeInTheDocument();
  });

  it("increments and decrements BPM via buttons", () => {
    render(<Metronome initialBpm={100} />);
    const plus5Btn = screen.getByText("+5");
    fireEvent.click(plus5Btn);
    expect(screen.getByText("105")).toBeInTheDocument();

    const minus5Btn = screen.getByText("-5");
    fireEvent.click(minus5Btn);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("switches time signature", () => {
    const { container } = render(<Metronome initialBpm={80} />);
    const button34 = screen.getByText(/3/);
    fireEvent.click(button34);
    // 3 beat indicator circles
    const dots = container.querySelectorAll(".rounded-full.h-4");
    expect(dots).toHaveLength(3);
  });
});
