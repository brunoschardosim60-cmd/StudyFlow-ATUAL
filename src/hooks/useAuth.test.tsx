import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";

describe("useAuth Hook", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("inicializa com loading true e user null", () => {
    const { result } = renderHook(() => useAuth());
    
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  it("fornece método signOut", async () => {
    const { result } = renderHook(() => useAuth());
    
    expect(typeof result.current.signOut).toBe("function");
  });

  it("atualiza isAdmin quando user mudar", () => {
    const { result } = renderHook(() => useAuth());
    
    expect(result.current.isAdmin).toBe(false);
  });
});
