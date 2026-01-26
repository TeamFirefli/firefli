import { NextPage } from "next";
import { useForm, FormProvider, SubmitHandler } from "react-hook-form";
import React, { useEffect, useState, useRef } from "react";
import { useRecoilState } from "recoil";
import { loginState } from "@/state";
import { themeState } from "@/state/theme";
import Button from "@/components/button";
import Router from "next/router";
import axios from "axios";
import Input from "@/components/input";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Dialog } from "@headlessui/react";
import { IconX } from "@tabler/icons-react";
import { OAuthAvailable } from "@/hooks/useOAuth";

type LoginForm = { username: string; password: string };
type SignupForm = {
  username: string;
  password: string;
  verifypassword: string;
};

const Login: NextPage = () => {
  const [login, setLogin] = useRecoilState(loginState);
  const { isAvailable: isOAuth, oauthOnly } = OAuthAvailable();

  const loginMethods = useForm<LoginForm>();
  const signupMethods = useForm<SignupForm>();

  const {
    register: regLogin,
    handleSubmit: submitLogin,
    setError: setErrLogin,
  } = loginMethods;
  const {
    register: regSignup,
    handleSubmit: submitSignup,
    setError: setErrSignup,
    getValues: getSignupValues,
  } = signupMethods;

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupStep, setSignupStep] = useState<0 | 1 | 2>(0);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);
  const [theme] = useRecoilState(themeState);
  const [mounted, setMounted] = useState(false);
  const isDarkModeRef = useRef(false);

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
          const y = yBase + 
            Math.sin(x * frequency + time + waveOffset) * amplitude +
            Math.sin(x * frequency * 2 + time * 1.5 + waveOffset) * (amplitude * 0.5);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        const waveGrad = ctx.createLinearGradient(0, yBase - amplitude, width, yBase + amplitude);
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

  // Reset state when switching modes
  useEffect(() => {
    loginMethods.reset();
    signupMethods.reset();
    setVerificationError(null);
    setSignupStep(0);
    setLoading(false);
    setUsernameCheckLoading(false);
    setUsernameAvailable(null);
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, []);

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 2) {
      setUsernameAvailable(null);
      return;
    }

    setUsernameCheckLoading(true);
    setUsernameAvailable(null);
    try {
      await axios.post("/api/auth/checkUsername", { username });
      signupMethods.clearErrors("username");
      setUsernameAvailable(true);
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error;
      if (errorMessage) {
        setErrSignup("username", {
          type: "custom",
          message: errorMessage,
        });
        setUsernameAvailable(false);
      }
    } finally {
      setUsernameCheckLoading(false);
    }
  };

  const onUsernameChange = (username: string) => {
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }

    signupMethods.clearErrors("username");
    setUsernameAvailable(null);

    usernameCheckTimeout.current = setTimeout(() => {
      checkUsernameAvailability(username);
    }, 800);
  };

  const onSubmitLogin: SubmitHandler<LoginForm> = async (data) => {
    setLoading(true);
    try {
      let req;
      try {
        req = await axios.post("/api/auth/login", data);
      } catch (e: any) {
        setLoading(false);
        if (e.response.status === 404) {
          setErrLogin("username", {
            type: "custom",
            message: e.response.data.error,
          });
          return;
        }
        if (e.response.status === 401) {
          // Only set error on password
          setErrLogin("password", {
            type: "custom",
            message: e.response.data.error,
          });
          return;
        }
        setErrLogin("username", {
          type: "custom",
          message: "Something went wrong",
        });
        setErrLogin("password", {
          type: "custom",
          message: "Something went wrong",
        });
        return;
      }
      const { data: res } = req;
      setLogin({ ...res.user, workspaces: res.workspaces });
      Router.push("/");
    } catch (e: any) {
      const msg = e.response?.data?.error || "Something went wrong";
      const status = e.response?.status;

      if (status === 404 || status === 401) {
        setErrLogin("username", { type: "custom", message: msg });
        if (status === 401)
          setErrLogin("password", { type: "custom", message: msg });
      } else {
        setErrLogin("username", { type: "custom", message: msg });
        setErrLogin("password", { type: "custom", message: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmitSignup: SubmitHandler<SignupForm> = async ({
    username,
    password,
    verifypassword,
  }) => {
    if (password !== verifypassword) {
      setErrSignup("verifypassword", {
        type: "validate",
        message: "Passwords must match",
      });
      return;
    }
    setLoading(true);
    setVerificationError(null);
    try {
      // Start signup (get verification code)
      const { data } = await axios.post("/api/auth/signup/start", { username });
      setVerificationCode(data.code);
      setSignupStep(2);
    } catch (e: any) {
      setErrSignup("username", {
        type: "custom",
        message: e.response?.data?.error || "Unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onVerifyAgain = async () => {
    setLoading(true);
    setVerificationError(null);

    const { password } = getSignupValues();

    try {
      const { data } = await axios.post("/api/auth/signup/finish", {
        password,
        code: verificationCode,
      });
      if (data.success) Router.push("/");
      else setVerificationError("Verification failed. Please try again.");
    } catch (e: any) {
      const errorMessage =
        e?.response?.data?.error || "Verification not found. Please try again.";
      setVerificationError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const StepButtons = ({
    backStep,
    forwardLabel,
    onForward,
  }: {
    backStep?: () => void;
    forwardLabel: string;
    onForward: () => void;
  }) => (
    <div className="flex gap-4">
      {backStep && (
        <Button
          onPress={backStep}
          type="button"
          classoverride="flex-1"
          loading={loading}
          disabled={loading}
        >
          Back
        </Button>
      )}
      <Button
        onPress={onForward}
        classoverride="flex-1"
        loading={loading}
        disabled={loading}
      >
        {forwardLabel}
      </Button>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />
      <div className="flex items-center justify-center min-h-screen px-4 relative" style={{ zIndex: 1 }}>
        <div className="bg-white/90 dark:bg-zinc-800/80 backdrop-blur-md max-w-md w-full rounded-3xl p-8 shadow-lg relative">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>

          <div className="mb-6 flex justify-center space-x-8">
            {["login", ...(oauthOnly ? [] : ["signup"])].map((m) => {
              const isActive = mode === m;
              const activeClass =
                theme === "dark"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "border-b-2 border-pink-500 text-pink-500";
              return (
                <button
                  key={m}
                  onClick={() => setMode(m as any)}
                  className={`pb-2 font-semibold text-lg ${
                    isActive ? activeClass : "text-zinc-500"
                  }`}
                  type="button"
                  disabled={loading}
                >
                  {m === "login" ? "Login" : "Sign Up"}
                </button>
              );
            })}
          </div>

          {mode === "login" && (
            <>
              <p className="font-bold text-3xl text-zinc-700 dark:text-white mb-2">
                👋 Welcome to Firefli
              </p>
              <p className="text-md text-zinc-600 dark:text-zinc-300 mb-6">
                Login to your account to continue
              </p>

              {!oauthOnly && (
                <FormProvider {...loginMethods}>
                  <form
                    onSubmit={submitLogin(onSubmitLogin)}
                    className="space-y-5 mb-6"
                    noValidate
                  >
                    <Input
                      label="Username"
                      placeholder="Username"
                      id="username"
                      {...regLogin("username", {
                        required: "This field is required",
                      })}
                    />
                    <Input
                      label="Password"
                      placeholder="Password"
                      type={showPassword ? "text" : "password"}
                      id="password"
                      {...regLogin("password", {
                        required: "This field is required",
                    })}
                  />
                  <div className="flex items-center mb-2">
                    <input
                      id="show-password"
                      type="checkbox"
                      checked={showPassword}
                      onChange={() => setShowPassword((v) => !v)}
                      className="mr-2 rounded-md border-gray-300 focus:ring-primary focus:border-primary transition"
                    />
                    <label
                      htmlFor="show-password"
                      className="text-sm text-zinc-600 dark:text-zinc-300 select-none"
                    >
                      Show password
                    </label>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Link
                        href="/forgot-password"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Forgot password?
                      </Link>
                      <Button
                        type="submit"
                        classoverride="px-6 py-2 text-sm rounded-lg"
                        loading={loading}
                        disabled={loading}
                      >
                        Login
                      </Button>
                    </div>

                    {isOAuth && (
                      <>
                        <div className="text-center">
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-zinc-300 dark:border-zinc-600" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-white dark:bg-zinc-700 px-2 text-zinc-500 dark:text-zinc-400">
                                Or
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="w-full">
                          <button
                            type="button"
                            onClick={() =>
                              (window.location.href = "/api/auth/roblox/start")
                            }
                            disabled={loading}
                            className="w-full flex items-center justify-center px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <img
                              src="/roblox.svg"
                              alt="Roblox"
                              className="w-5 h-5 mr-2 dark:invert-0 invert"
                            />
                            Continue with Roblox
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </form>
              </FormProvider>
              )}

              {isOAuth && oauthOnly && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      (window.location.href = "/api/auth/roblox/start")
                    }
                    disabled={loading}
                    className="w-full flex items-center justify-center px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <img
                      src="/roblox.svg"
                      alt="Roblox"
                      className="w-5 h-5 mr-2 dark:invert-0 invert"
                    />
                    Continue with Roblox
                  </button>
                </div>
              )}
            </>
          )}

          {mode === "signup" && (
            <>
              {signupStep === 0 && (
                <>
                  <p className="font-bold text-3xl text-zinc-700 dark:text-white mb-2">
                    🔨 Create an account
                  </p>
                  <p className="text-md text-zinc-600 dark:text-zinc-300 mb-6">
                    Create a new account for Firefli
                  </p>

                  {!oauthOnly && (
                    <FormProvider {...signupMethods}>
                      <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setSignupStep(1);
                      }}
                      className="space-y-5 mb-6"
                      noValidate
                    >
                      <Input
                        label="Username"
                        placeholder="Username"
                        id="signup-username"
                        {...regSignup("username", {
                          required: "This field is required",
                          onChange: (e) => {
                            regSignup("username").onChange(e);
                            onUsernameChange(e.target.value);
                          },
                        })}
                      />
                      {usernameCheckLoading && (
                        <p className="text-sm text-blue-500 mt-1">
                          Checking username...
                        </p>
                      )}
                      {!usernameCheckLoading && usernameAvailable === true && (
                        <p className="text-sm text-green-500 mt-1">
                          ✓ User signup is available
                        </p>
                      )}
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          loading={loading}
                          disabled={
                            loading ||
                            usernameCheckLoading ||
                            usernameAvailable !== true ||
                            !!signupMethods.formState.errors.username
                          }
                        >
                          Continue
                        </Button>
                      </div>
                    </form>
                  </FormProvider>
                  )}

                  {isOAuth && (
                    <>
                      {!oauthOnly && (
                        <div className="mt-4">
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-zinc-300 dark:border-zinc-600" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-white dark:bg-zinc-700 px-2 text-zinc-500 dark:text-zinc-400">
                                Or
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() =>
                            (window.location.href = "/api/auth/roblox/start")
                          }
                          disabled={loading}
                          className="w-full flex items-center justify-center px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <img
                            src="/roblox.svg"
                            alt="Roblox"
                            className="w-5 h-5 mr-2 dark:invert-0 invert"
                          />
                          Sign up with Roblox
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {signupStep === 1 && (
                <>
                  <p className="font-bold text-3xl text-zinc-700 dark:text-white mb-2">
                    🔒 Set a password
                  </p>
                  <p className="text-md text-zinc-600 dark:text-zinc-300 mb-6">
                    Choose a password for your new account
                  </p>

                  <FormProvider {...signupMethods}>
                    <form
                      onSubmit={submitSignup(onSubmitSignup)}
                      className="space-y-5 mb-6"
                      noValidate
                    >
                      <Input
                        label="Password"
                        placeholder="Password"
                        type="password"
                        id="signup-password"
                        {...regSignup("password", {
                          required: "Password is required",
                          minLength: {
                            value: 7,
                            message: "Password must be at least 7 characters",
                          },
                          pattern: {
                            value: /^(?=.*[0-9!@#$%^&*])/,
                            message:
                              "Password must contain at least one number or special character",
                          },
                        })}
                      />
                      <Input
                        label="Verify password"
                        placeholder="Verify Password"
                        type="password"
                        id="signup-verify-password"
                        {...regSignup("verifypassword", {
                          required: "Please verify your password",
                          validate: (value) =>
                            value === getSignupValues("password") ||
                            "Passwords must match",
                        })}
                      />
                      <div className="flex gap-2 justify-between">
                        <Button
                          type="button"
                          classoverride="flex-1 px-3 py-1 text-sm rounded-md"
                          onPress={() => setSignupStep(0)}
                          disabled={loading}
                        >
                          Back
                        </Button>
                        <Button
                          type="submit"
                          classoverride="flex-1 px-3 py-1 text-sm rounded-md"
                          loading={loading}
                          disabled={loading}
                        >
                          Continue
                        </Button>
                      </div>

                      {isOAuth && (
                        <>
                          <div className="mt-4">
                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-zinc-300 dark:border-zinc-600" />
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white dark:bg-zinc-700 px-2 text-zinc-500 dark:text-zinc-400">
                                  Or
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() =>
                                (window.location.href =
                                  "/api/auth/roblox/start")
                              }
                              disabled={loading}
                              className="w-full flex items-center justify-center px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <img
                                src="/roblox.svg"
                                alt="Roblox"
                                className="w-5 h-5 mr-2"
                              />
                              Sign up with Roblox
                            </button>
                          </div>
                        </>
                      )}

                      <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                        <strong>Don't share your password.</strong>
                        <br />
                        <span>
                          Do not use the same password as your Roblox account.
                        </span>
                      </div>
                    </form>
                  </FormProvider>
                </>
              )}

              {signupStep === 2 && (
                <>
                  <p className="font-bold text-3xl dark:text-white mb-2">
                    Verify your account
                  </p>
                  <p className="text-md text-zinc-600 dark:text-zinc-300 mb-6">
                    Paste this code into your Roblox profile bio:
                  </p>
                  <p className="text-center font-mono bg-zinc-700 text-white py-3 rounded mb-4 select-all">
                    {verificationCode}
                  </p>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 space-y-1">
                    <p>• Go to your Roblox profile</p>
                    <p>• Click "Edit Profile"</p>
                    <p>• Paste the code above into your Bio/About section</p>
                    <p>• Save your profile and click "Verify" below</p>
                  </div>
                  {verificationError && (
                    <p className="text-center text-red-500 mb-4 font-semibold">
                      {verificationError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      classoverride="flex-1"
                      onPress={() => setSignupStep(1)}
                      disabled={loading}
                    >
                      Back
                    </Button>
                    <Button
                      classoverride="flex-1"
                      loading={loading}
                      disabled={loading}
                      onPress={onVerifyAgain}
                    >
                      Verify
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        {/* Copyright button fixed at bottom left */}
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

      {/* Copyright Notices Dialog */}
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
                  Copyright © 2025 Planetary. All rights reserved.
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
    </div>
  );
};

export default Login;
