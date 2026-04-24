import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import Auth from "@/pages/Auth";

describe("Auth Page", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza modo login por padrão", () => {
    render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );
    
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });

  it("alterna entre login e signup", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );
    
    const signupButton = screen.getByRole("button", { name: /sign up/i });
    await user.click(signupButton);
    
    expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
  });

  it("valida email vazio", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );
    
    const submitButton = screen.getByRole("button", { name: /login/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/email.*required/i)).toBeInTheDocument();
    });
  });

  it("toggle password visibility", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );
    
    const passwordInput = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    const toggleButton = screen.getByRole("button", { name: /show password/i });
    
    expect(passwordInput.type).toBe("password");
    
    await user.click(toggleButton);
    expect(passwordInput.type).toBe("text");
  });
});
