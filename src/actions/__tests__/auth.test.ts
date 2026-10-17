import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, CredentialsSignin } from "next-auth";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  signIn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next-auth", () => import("@auth/core/errors"));
vi.mock("@/lib/auth", () => ({ signOut: vi.fn(), signIn: mocks.signIn }));

import { loginAction, signupAction } from "@/actions/auth";

describe("loginAction", () => {
  beforeEach(() => {
    mocks.signIn.mockReset();
  });

  function credentials() {
    const formData = new FormData();
    formData.set("email", "owner@example.com");
    formData.set("password", "a-private-password");
    return formData;
  }

  it("returns actionable feedback for rejected credentials without exposing the cause", async () => {
    mocks.signIn.mockRejectedValue(new CredentialsSignin("private provider detail"));

    await expect(loginAction({}, credentials())).resolves.toEqual({
      error: "Unable to sign in. Check your email and password.",
    });
  });

  it("returns a retry message for other authentication errors", async () => {
    mocks.signIn.mockRejectedValue(new AuthError("private provider detail"));

    await expect(loginAction({}, credentials())).resolves.toEqual({
      error: "Sign-in is temporarily unavailable. Please try again.",
    });
  });

  it("preserves successful redirect signals", async () => {
    const redirect = new Error("NEXT_REDIRECT:/dashboard");
    mocks.signIn.mockRejectedValue(redirect);

    await expect(loginAction({}, credentials())).rejects.toBe(redirect);
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "owner@example.com",
      password: "a-private-password",
      redirectTo: "/dashboard",
    });
  });

  it("does not hide unexpected programming errors", async () => {
    const error = new TypeError("unexpected failure");
    mocks.signIn.mockRejectedValue(error);

    await expect(loginAction({}, credentials())).rejects.toBe(error);
  });
});

describe("signupAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.create.mockResolvedValue({ id: "user-new" });
  });

  it("creates a normal isolated user account with phone number", async () => {
    const formData = new FormData();
    formData.set("name", "Friend User");
    formData.set("email", "friend@example.com");
    formData.set("phone", "+352 621 123456");
    formData.set("password", "secure-password");
    formData.set("confirmPassword", "secure-password");

    await expect(signupAction({}, formData)).rejects.toThrow("NEXT_REDIRECT:/login?signup=success");

    expect(mocks.prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "friend@example.com",
        name: "Friend User",
        phone: "+352 621 123456",
        role: "USER",
      }),
    });
  });

  it("rejects invalid phone numbers", async () => {
    const formData = new FormData();
    formData.set("name", "Friend User");
    formData.set("email", "friend@example.com");
    formData.set("phone", "abc");
    formData.set("password", "secure-password");
    formData.set("confirmPassword", "secure-password");

    await expect(signupAction({}, formData)).resolves.toEqual({
      error: "Phone number is too short",
    });
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });
});
