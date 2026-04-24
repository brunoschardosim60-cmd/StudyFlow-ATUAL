import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardHero } from "@/components/DashboardHero";

describe("DashboardHero Component", () => {
  it("renderiza com nome do usuário", () => {
    render(
      <DashboardHero 
        userName="Bruno" 
        totalMinutesStudied={120}
        streakDays={5}
      />
    );
    
    expect(screen.getByText(/bruno/i)).toBeInTheDocument();
  });

  it("exibe estatísticas de estudo", () => {
    render(
      <DashboardHero 
        userName="Bruno" 
        totalMinutesStudied={120}
        streakDays={5}
      />
    );
    
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it("renderiza com dados vazios", () => {
    render(
      <DashboardHero 
        userName="" 
        totalMinutesStudied={0}
        streakDays={0}
      />
    );
    
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });
});
