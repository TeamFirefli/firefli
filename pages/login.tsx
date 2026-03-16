import { NextPage } from "next";
import { useForm, FormProvider, SubmitHandler } from "react-hook-form";
import React, { useEffect, useState, useRef } from "react";
import { useRecoilState } from "recoil";
import { loginState } from "@/state";
import { themeState } from "@/state/theme";
import Button from "@/components/button";
import Router, { useRouter } from "next/router";
import axios from "axios";
import Input from "@/components/input";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Dialog } from "@headlessui/react";
import { IconX } from "@tabler/icons-react";
import { OAuthAvailable } from "@/hooks/useOAuth";
import toast from "react-hot-toast";

type LoginForm = { username: string; password: string };
type SignupForm = {
  username: string;
  password: string;
  verifypassword: string;
};

const Login: NextPage = () => {
  const [login, setLogin] = useRecoilState(loginState);
  const { isAvailable: isOAuth, oauthOnly } = OAuthAvailable();
  const router = useRouter();

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
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);
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
    if (!router.isReady) return;

    const error = router.query.error as string;
    if (error) {
      let message = 'An error occurred during login.';
      let isSuspended = false;
      switch (error) {
        case 'access_denied':
          message = 'Access denied. Your account has been blocked from accessing this system.';
          isSuspended = true;
          break;
        case 'oauth_error':
          message = 'OAuth authentication failed. Please try again.';
          break;
        case 'missing_params':
          message = 'Missing required authentication parameters.';
          break;
        case 'state_mismatch':
          message = 'Security verification failed. Please try logging in again.';
          break;
        case 'config_error':
          message = 'Server configuration error. Please contact an administrator.';
          break;
        case 'invalid_user':
          message = 'Invalid user information received from Roblox.';
          break;
        case 'database_error':
          message = 'Database error during login. Please try again.';
          break;
        case 'oauth_failed':
          message = 'OAuth authentication failed. Please check your credentials and try again.';
          break;
        case 'account_suspended':
          message = 'Your account has been suspended. Please contact support for an appeal.';
          isSuspended = true;
          break;
      }

      if (isSuspended) {
        setSuspendedMessage(message);
      } else {
        toast.error(message, {
          duration: 6000,
          position: 'top-center',
        });
      }

      router.replace('/login', undefined, { shallow: true });
    }
  }, [router.isReady, router.query.error]);

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

    type Firefly = {
      x: number;
      y: number;
      radius: number;
      speedX: number;
      speedY: number;
      glow: number;
      phase: number;
    };

    let fireflies: Firefly[] = [];

    const buildFireflies = () => {
      const desktop = window.innerWidth >= 1024;
      if (!desktop) {
        fireflies = [];
        return;
      }

      const count = Math.max(18, Math.min(42, Math.floor(window.innerWidth / 42)));
      fireflies = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: Math.random() * 2.2 + 1,
        speedX: Math.random() * 0.45 + 0.18,
        speedY: (Math.random() - 0.5) * 0.18,
        glow: Math.random() * 0.35 + 0.4,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    canvas.width = width;
    canvas.height = height;
    buildFireflies();

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

      if (width >= 1024) {
        fireflies.forEach((firefly, index) => {
          firefly.x += firefly.speedX;
          firefly.y += firefly.speedY + Math.sin(time * 5 + firefly.phase) * 0.12;

          if (firefly.x - firefly.radius > width) {
            firefly.x = -firefly.radius;
            firefly.y = Math.random() * height;
          }

          if (firefly.y < 0) {
            firefly.y = height;
          } else if (firefly.y > height) {
            firefly.y = 0;
          }

          const pulse = 0.65 + Math.sin(time * 8 + firefly.phase + index * 0.35) * 0.35;
          const alpha = firefly.glow * pulse;
          const glowRadius = firefly.radius * 5.5;

          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 220, 102, ${alpha * 0.2})`;
          ctx.arc(firefly.x, firefly.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 232, 140, ${alpha})`;
          ctx.arc(firefly.x, firefly.y, firefly.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animationId = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      buildFireflies();
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
        if (e.response.status === 403) {
          const msg = e.response?.data?.error || 'Your account has been suspended.';
          setSuspendedMessage(msg);
          return;
        }
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
      <div className="absolute inset-y-0 right-0 hidden w-full max-w-[34rem] bg-white/70 shadow-[-24px_0_80px_rgba(15,23,42,0.12)] dark:bg-zinc-900/80 lg:block" />
      <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-0 lg:pr-0" style={{ zIndex: 1 }}>
        <div className="pointer-events-none absolute left-10 top-8 hidden lg:block">
          <img
            src="/wlogo.svg"
            alt="Firefli"
            className="h-12 w-auto drop-shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
          />
        </div>
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6 lg:hidden">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center lg:min-h-screen lg:max-w-none lg:items-stretch lg:gap-16">
          <div className="hidden lg:block lg:flex-1" aria-hidden="true" />

          <div className="flex w-full items-center justify-center lg:ml-auto lg:min-w-[30rem] lg:max-w-[34rem] lg:justify-end lg:self-stretch">
            <div className="relative w-full rounded-[2rem] bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.22)] backdrop-blur-md dark:bg-zinc-800/80 sm:p-9 lg:flex lg:min-h-screen lg:rounded-none lg:border-l lg:border-zinc-200/70 lg:bg-white/88 lg:px-10 lg:py-24 lg:shadow-none lg:backdrop-blur-xl dark:lg:border-zinc-700/60 dark:lg:bg-zinc-900/82">
              <div className="absolute right-8 top-8 hidden lg:block">
                <ThemeToggle />
              </div>
              <div className="w-full lg:my-auto">
              <div className="-mt-6 mb-5 flex justify-center">
                <img
                  src="/logo.svg"
                  alt="Firefli logo"
                  className="h-10 w-auto sm:h-12"
                />
              </div>
              {suspendedMessage && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
                  <p className="text-center text-sm font-medium text-red-800 dark:text-red-200">
                    {suspendedMessage}
                  </p>
                </div>
              )}

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
                  <p className="mb-2 font-bold text-3xl text-zinc-700 dark:text-white">
                    👋 Welcome to Firefli
                  </p>
                  <p className="mb-6 text-md text-zinc-600 dark:text-zinc-300">
                    Login to your account to continue
                  </p>

                  {!oauthOnly && (
                    <FormProvider {...loginMethods}>
                      <form
                        onSubmit={submitLogin(onSubmitLogin)}
                        className="mb-6 space-y-5"
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
                        <div className="mb-2 flex items-center">
                          <input
                            id="show-password"
                            type="checkbox"
                            checked={showPassword}
                            onChange={() => setShowPassword((v) => !v)}
                            className="mr-2 rounded-md border-gray-300 transition focus:border-primary focus:ring-primary"
                          />
                          <label
                            htmlFor="show-password"
                            className="select-none text-sm text-zinc-600 dark:text-zinc-300"
                          >
                            Show password
                          </label>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Link
                              href="/forgot-password"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              Forgot password?
                            </Link>
                            <Button
                              type="submit"
                              classoverride="rounded-lg px-6 py-2 text-sm"
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
                                    <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
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
                                  className="w-full flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                >
                                  <img
                                    src="/roblox.svg"
                                    alt="Roblox"
                                    className="mr-2 h-5 w-5 invert dark:invert-0"
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
                        className="w-full flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        <img
                          src="/roblox.svg"
                          alt="Roblox"
                          className="mr-2 h-5 w-5 invert dark:invert-0"
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
                      <p className="mb-2 font-bold text-3xl text-zinc-700 dark:text-white">
                        🔨 Create an account
                      </p>
                      <p className="mb-6 text-md text-zinc-600 dark:text-zinc-300">
                        Create a new account for Firefli
                      </p>

                      {!oauthOnly && (
                        <FormProvider {...signupMethods}>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              setSignupStep(1);
                            }}
                            className="mb-6 space-y-5"
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
                              <p className="mt-1 text-sm text-blue-500">
                                Checking username...
                              </p>
                            )}
                            {!usernameCheckLoading && usernameAvailable === true && (
                              <p className="mt-1 text-sm text-green-500">
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
                                  <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
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
                              className="w-full flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                            >
                              <img
                                src="/roblox.svg"
                                alt="Roblox"
                                className="mr-2 h-5 w-5 invert dark:invert-0"
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
                      <p className="mb-2 font-bold text-3xl text-zinc-700 dark:text-white">
                        🔒 Set a password
                      </p>
                      <p className="mb-6 text-md text-zinc-600 dark:text-zinc-300">
                        Choose a password for your new account
                      </p>

                      <FormProvider {...signupMethods}>
                        <form
                          onSubmit={submitSignup(onSubmitSignup)}
                          className="mb-6 space-y-5"
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
                          <div className="flex justify-between gap-2">
                            <Button
                              type="button"
                              classoverride="flex-1 rounded-md px-3 py-1 text-sm"
                              onPress={() => setSignupStep(0)}
                              disabled={loading}
                            >
                              Back
                            </Button>
                            <Button
                              type="submit"
                              classoverride="flex-1 rounded-md px-3 py-1 text-sm"
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
                                    <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
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
                                  className="w-full flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                >
                                  <img
                                    src="/roblox.svg"
                                    alt="Roblox"
                                    className="mr-2 h-5 w-5"
                                  />
                                  Sign up with Roblox
                                </button>
                              </div>
                            </>
                          )}

                          <div className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
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
                      <p className="mb-2 font-bold text-3xl dark:text-white">
                        Verify your account
                      </p>
                      <p className="mb-6 text-md text-zinc-600 dark:text-zinc-300">
                        Paste this code into your Roblox profile bio:
                      </p>
                      <p className="mb-4 select-all rounded bg-zinc-700 py-3 text-center font-mono text-white">
                        {verificationCode}
                      </p>
                      <div className="mb-4 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                        <p>• Go to your Roblox profile</p>
                        <p>• Click "Edit Profile"</p>
                        <p>• Paste the code above into your Bio/About section</p>
                        <p>• Save your profile and click "Verify" below</p>
                      </div>
                      {verificationError && (
                        <p className="mb-4 text-center font-semibold text-red-500">
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
            </div>
          </div>
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
                  Copyright © 2026 Planetary. All rights reserved.
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
