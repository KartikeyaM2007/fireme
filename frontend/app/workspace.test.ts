import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const authMocks = vi.hoisted(() => ({
  getToken: vi.fn(async () => "session-token"),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    userId: "user_test",
    getToken: authMocks.getToken,
  }),
  useUser: () => ({
    user: {
      fullName: "Test User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
    },
  }),
  Show: ({ children }: { children: unknown }) => children,
  SignInButton: ({ children }: { children: unknown }) => children,
  SignUpButton: ({ children }: { children: unknown }) => children,
  UserButton: () => null,
}));

const meeting = {
  id: 88,
  title: "Planning",
  occurred_at: "2026-07-20T09:00:00",
  duration_seconds: 60,
  participants: ["Ava"],
  summary: "",
  topics: [],
  chapters: [],
  processing_status: "ready",
  segments: [],
  actions: [],
  notes: [],
};

describe("Workspace", () => {
  beforeEach(() => {
    authMocks.getToken.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (String(url).includes("/meetings?") ? [meeting] : meeting),
      })),
    );
  });

  it("sends an inclusive date range with the Clerk bearer token", async () => {
    render(createElement(Home));
    fireEvent.click(screen.getByRole("button", { name: /See it in action/i }));
    fireEvent.change(screen.getByLabelText("Filter from date"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText("Filter to date"), {
      target: { value: "2026-07-31" },
    });
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const calls = vi.mocked(fetch).mock.calls;
    const rangeRequest = calls
      .map(([url]) => String(url))
      .find((url) => url.includes("date_from") && url.includes("date_to"));
    expect(decodeURIComponent(rangeRequest || "")).toContain(
      "date_from=2026-07-01T00:00:00",
    );
    expect(decodeURIComponent(rangeRequest || "")).toContain(
      "date_to=2026-07-31T23:59:59.999",
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([, options]) =>
            new Headers(options?.headers).get("Authorization") ===
            "Bearer session-token",
        ),
    ).toBe(true);
    expect(authMocks.getToken.mock.calls.length).toBeGreaterThan(1);
  });
});
