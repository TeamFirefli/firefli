import { NextPage } from "next";
import React, { useState, useRef, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import axios from "axios";
import Router from "next/router";
import Input from "@/components/input";
import Button from "@/components/button";
import { Dialog } from "@headlessui/react";
import { IconX } from "@tabler/icons-react";
import { useRecoilState } from "recoil";
import { themeState } from "@/state/theme";
import ThemeToggle from "@/components/ThemeToggle";

type FormData = {
  username: string;
};

type ResetPasswordData = {
  password: string;
  verifypassword: string;
};

const ForgotPassword: NextPage = () => {
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCopyright, setShowCopyright] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theme] = useRecoilState(themeState);
  const [mounted, setMounted] = useState(false);
  const isDarkModeRef = useRef(false);

  const usernameForm = useForm<FormData>();
  const passwordForm = useForm<ResetPasswordData>();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const isDark = theme === "dark";
    isDarkModeRef.current = isDark;
  }, [mounted, theme]);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationId: number;
    let time = 0;

    canvas.width = width;
    canvas.height = height;

    const animate = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      time += 0.005;
      const dark = isDarkModeRef.current;

      if (dark) {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#0a0a0f");
        bgGrad.addColorStop(0.3, "#1a1a2e");
        bgGrad.addColorStop(0.6, "#16213e");
        bgGrad.addColorStop(1, "#0f0f1a");
        ctx.fillStyle = bgGrad;
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#a8edea");
        bgGrad.addColorStop(0.5, "#fed6e3");
        bgGrad.addColorStop(1, "#d299c2");
        ctx.fillStyle = bgGrad;
      }
      ctx.fillRect(0, 0, width, height);
      const waveCount = 4;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();

        const waveOffset = w * 0.5;
        const amplitude = 30 + w * 15;
        const frequency = 0.003 + w * 0.001;
        const yBase = height * (0.5 + w * 0.12);

        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 5) {
          const y =
            yBase +
            Math.sin(x * frequency + time + waveOffset) * amplitude +
            Math.sin(x * frequency * 2 + time * 1.5 + waveOffset) *
              (amplitude * 0.5);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        const waveGrad = ctx.createLinearGradient(
          0,
          yBase - amplitude,
          width,
          yBase + amplitude,
        );
        const alpha = 0.15 - w * 0.03;

        if (dark) {
          waveGrad.addColorStop(0, `rgba(99, 102, 241, ${alpha})`);
          waveGrad.addColorStop(0.5, `rgba(139, 92, 246, ${alpha})`);
          waveGrad.addColorStop(1, `rgba(59, 130, 246, ${alpha})`);
        } else {
          waveGrad.addColorStop(0, `rgba(244, 114, 182, ${alpha + 0.1})`);
          waveGrad.addColorStop(0.5, `rgba(168, 85, 247, ${alpha + 0.1})`);
          waveGrad.addColorStop(1, `rgba(99, 102, 241, ${alpha + 0.1})`);
        }
        ctx.fillStyle = waveGrad;
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, [mounted]);

  const startReset = async () => {
    setError(null);
    try {
      const response = await axios.post("/api/auth/reset/start", {
        username: usernameForm.getValues("username"),
      });
      setCode(response.data.code);
      setSelectedSlide(1);
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? "Something went wrong";
      usernameForm.setError("username", { type: "manual", message: msg });
    }
  };

  const finishReset = async () => {
    setError(null);
    try {
      await axios.post("/api/auth/reset/finish", {
        password: passwordForm.getValues("password"),
      });
      Router.push("/");
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? "Verification failed";
      setError(msg);
    }
  };

  return (
    <>
      <div className="relative min-h-screen overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 0 }}
        />
        <div
          className="flex items-center justify-center min-h-screen px-4 relative"
          style={{ zIndex: 1 }}
        >
          <div className="bg-white/90 dark:bg-zinc-800/80 backdrop-blur-md max-w-md w-full rounded-3xl p-8 shadow-lg relative">
            <div className="absolute top-4 right-4">
              <ThemeToggle />
            </div>

            {selectedSlide === 0 && (
              <>
                <p className="font-bold text-2xl dark:text-white mb-2">
                  Forgot your password?
                </p>
                <p className="text-md text-zinc-500 dark:text-zinc-200 mb-6">
                  Enter your Roblox username to begin resetting your password.
                </p>
                <FormProvider {...usernameForm}>
                  <form
                    className="mb-8 mt-2 space-y-5"
                    onSubmit={usernameForm.handleSubmit(startReset)}
                  >
                    <Input
                      placeholder="Username"
                      label="Username"
                      id="username"
                      {...usernameForm.register("username", {
                        required: "This field is required",
                      })}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        classoverride="px-6 py-2 text-sm rounded-lg"
                      >
                        Continue
                      </Button>
                    </div>
                  </form>
                </FormProvider>
              </>
            )}

            {selectedSlide === 1 && (
              <>
                <p className="font-bold text-2xl dark:text-white mb-2">
                  Verify your Roblox account
                </p>
                <p className="text-md text-zinc-500 dark:text-zinc-200 mb-6">
                  Paste the below code into your Roblox profile blurb to prove
                  ownership:
                </p>
                <p className="text-lg text-zinc-500 dark:text-zinc-200 text-center mt-4 leading-10">
                  <code className="bg-zinc-600 p-2 rounded-lg">{code}</code>
                </p>
                {error && (
                  <p className="text-center mt-4">
                    <span className="bg-red-600 p-2 mt-2 rounded-lg">
                      {error}
                    </span>
                  </p>
                )}
                <div className="mt-7 flex gap-2">
                  <Button
                    type="button"
                    classoverride="flex-1"
                    onPress={() => setSelectedSlide(0)}
                  >
                    Back
                  </Button>
                  <Button
                    classoverride="flex-1"
                    onPress={async () => {
                      setError(null);
                      try {
                        const response = await axios.post(
                          "/api/auth/reset/verify",
                        );
                        if (response.data.success) {
                          setSelectedSlide(2);
                        }
                      } catch (e: any) {
                        const msg =
                          e?.response?.data?.error || "Verification failed";
                        setError(msg);
                      }
                    }}
                  >
                    Verify
                  </Button>
                </div>
              </>
            )}

            {selectedSlide === 2 && (
              <>
                <p className="font-bold text-2xl dark:text-white mb-2">
                  Set your new password
                </p>
                <p className="text-md text-zinc-500 dark:text-zinc-200 mb-6">
                  Enter and confirm your new password
                </p>
                <FormProvider {...passwordForm}>
                  <form
                    className="mb-8 mt-2 space-y-5"
                    onSubmit={passwordForm.handleSubmit(finishReset)}
                  >
                    <Input
                      type="password"
                      {...passwordForm.register("password", {
                        required: "You must enter a password",
                      })}
                      label="New Password"
                    />
                    <Input
                      type="password"
                      {...passwordForm.register("verifypassword", {
                        required: "Please confirm your password",
                        validate: (value) =>
                          value === passwordForm.getValues("password") ||
                          "Passwords must match",
                      })}
                      label="Confirm Password"
                    />
                    <div className="flex gap-2 justify-between">
                      <Button
                        type="button"
                        classoverride="px-6 py-2 text-sm rounded-lg"
                        onPress={() => setSelectedSlide(1)}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        classoverride="px-6 py-2 text-sm rounded-lg"
                      >
                        Reset Password
                      </Button>
                    </div>
                    <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                      <strong>Don't share your password.</strong>
                      <br />
                      <span>
                        Do not use the same password as your Roblox account.
                      </span>
                    </div>
                  </form>
                </FormProvider>
                {error && (
                  <p className="text-center mt-4">
                    <span className="bg-red-600 p-2 mt-2 rounded-lg">
                      {error}
                    </span>
                  </p>
                )}
              </>
            )}
          </div>

          <div className="fixed bottom-4 left-4 z-40">
            <button
              onClick={() => setShowCopyright(true)}
              className="text-left text-xs text-zinc-500 hover:text-primary"
              type="button"
            >
              © Copyright Notices
            </button>
          </div>
        </div>
      </div>

      <Dialog
        open={showCopyright}
        onClose={() => setShowCopyright(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-sm rounded-lg bg-white dark:bg-zinc-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-medium text-zinc-900 dark:text-white">
                Copyright Notices
              </Dialog.Title>
              <button
                onClick={() => setShowCopyright(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <IconX className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                  Firefli features, enhancements, and modifications:
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Copyright © 2026 Firefli. All rights reserved.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                  Orbit features, enhancements, and modifications:
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Copyright © 2025 Firefli. All rights reserved.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                  Original Tovy features and code:
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Copyright © 2022 Tovy. All rights reserved.
                </p>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
};

export default ForgotPassword;
