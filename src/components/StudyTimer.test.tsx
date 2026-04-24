import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudyTimer } from "@/components/StudyTimer";

describe("StudyTimer Component", () => {
  it("renderiza timer com duração padrão", () => {
    render(<StudyTimer activeTopicId="topic-1" activeSubject="Matemática" />);
    
    expect(screen.getByText(/study timer/i)).toBeInTheDocument();
  });

  it("inicia e pausa o timer", async () => {
    const user = userEvent.setup();
    render(<StudyTimer activeTopicId="topic-1" activeSubject="Matemática" />);
    
    const startButton = screen.getByRole("button", { name: /start/i });
    await user.click(startButton);
    
    const pauseButton = screen.getByRole("button", { name: /pause/i });
    expect(pauseButton).toBeInTheDocument();
    
    await user.click(pauseButton);
    expect(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();
  });

  it("reseta o timer", async () => {
    const user = userEvent.setup();
    render(<StudyTimer activeTopicId="topic-1" activeSubject="Matemática" />);
    
    const resetButton = screen.getByRole("button", { name: /reset/i });
    await user.click(resetButton);
    
    expect(screen.getByText(/00:00/)).toBeInTheDocument();
  });
});
