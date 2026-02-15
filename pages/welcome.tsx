import type { NextPage } from "next";
import React, { useEffect, useState, useRef } from "react";
import { loginState } from "@/state";
import { themeState } from "@/state/theme";
import { useRecoilState } from "recoil";
import { useForm, FormProvider } from "react-hook-form";
import Router from "next/router";
import Slider from "@/components/slider";
import Input from "@/components/input";
import axios from "axios";
import { toast } from "react-hot-toast";
import { IconCheck, IconX, IconLoader2 } from "@tabler/icons-react";

type FormData = {
	username: string;
	password: string;
	verifypassword: string;
};

const Login: NextPage = () => {
	const [selectedColor, setSelectedColor] = useState("bg-firefli");
	const [login, setLogin] = useRecoilState(loginState);
	const [isLoading, setIsLoading] = useState(false);
	const methods = useForm<{groupid: string}>();
	const signupform = useForm<FormData>();
	const { register, handleSubmit, watch, formState: { errors } } = methods;
	const [selectedSlide, setSelectedSlide] = useState(0);
	const [ready, setReady] = useState(false);
	const [useCreateWs, setUseCreateWs] = useState(false);
	const [robloxApiKey, setRobloxApiKey] = useState("");
	const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");
	const [apiKeyMessage, setApiKeyMessage] = useState("");
	const canCreateAdditional = useCreateWs
		? login?.canMakeWorkspace
		: true;

	useEffect(() => {
		const check = async () => {
			try {
				const req = await axios.get('/api/@me');
				const userData = req.data;
				setLogin({ ...userData.user, workspaces: userData.workspaces || [] });
				setUseCreateWs(true);
				if (!userData.user.canMakeWorkspace) {
					Router.push('/');
					return;
				}
				setReady(true);
			} catch (err: any) {
				if (err.response?.data?.error === 'Workspace not setup') {
					setUseCreateWs(false);
					setReady(true);
					return;
				}
				if (err.response?.data?.error === 'Not logged in') {
					Router.push('/login');
					return;
				}
				setReady(true);
			}
		};
		check();
	}, []);

	const canvasRef = useRef<HTMLCanvasElement>(null);
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
	}, [mounted, ready]);

	const testApiKey = async () => {
		const groupId = methods.getValues("groupid");
		if (!groupId || !robloxApiKey) {
			toast.error("Please enter both a Group ID and API key.");
			return;
		}
		setApiKeyStatus("testing");
		setApiKeyMessage("");
		try {
			const res = await axios.post("/api/test-roblox-key", {
				apiKey: robloxApiKey,
				groupId: Number(groupId),
			});
			if (res.data.valid) {
				setApiKeyStatus("valid");
				setApiKeyMessage(res.data.message);
			} else {
				setApiKeyStatus("invalid");
				setApiKeyMessage(res.data.message);
			}
		} catch (e: any) {
			setApiKeyStatus("invalid");
			setApiKeyMessage(
				e?.response?.data?.message || "Failed to test API key."
			);
		}
	};

	const watchedGroupId = methods.watch("groupid");
	useEffect(() => {
		setApiKeyStatus("idle");
		setApiKeyMessage("");
	}, [watchedGroupId]);

	async function createAccount() {
		if (apiKeyStatus !== "valid") {
			toast.error("Please test and validate your Roblox Open Cloud API key before continuing.");
			return;
		}
		setIsLoading(true);
		let request: { data: { success: boolean; workspaceGroupId?: number; user?: any } } | undefined;
		
		try {
			if (useCreateWs) {
				request = await Promise.race([
					axios.post('/api/createws', {
						groupId: Number(methods.getValues("groupid")),
						robloxApiKey,
					}),
					new Promise((_, reject) => 
						setTimeout(() => reject(new Error('Request timeout')), 30000)
					)
				]) as { data: { success: boolean; workspaceGroupId?: number } };

				if (request?.data.success && request.data.workspaceGroupId) {
					toast.success('Workspace created successfully!');
					const userReq = await axios.get('/api/@me');
					if (userReq.data) {
						setLogin({
							...userReq.data.user,
							workspaces: userReq.data.workspaces,
						});
					}
					Router.push(`/workspace/${request.data.workspaceGroupId}?new=true`);
					return;
				}
			} else {
				request = await Promise.race([
					axios.post('/api/setupworkspace', {
						groupid: methods.getValues("groupid"),
						username: signupform.getValues("username"),
						password: signupform.getValues("password"),
						color: selectedColor,
						robloxApiKey,
					}),
					new Promise((_, reject) => 
						setTimeout(() => reject(new Error('Request timeout')), 30000)
					)
				]) as { data: { success: boolean; user?: any } };

				if (request?.data.success) {
					toast.success('Workspace created successfully!');
					setLogin(prev => ({
						...prev,
						...request?.data.user,
						isOwner: true
					}));
					Router.push("/");
					return;
				}
			}
		} catch (e: any) {
			if (e?.response?.status === 404) {
				signupform.setError("username", { 
					type: "custom", 
					message: e.response.data.error 
				});
				toast.error('Username not found');
			} else if (e?.response?.status === 403 || e?.response?.status === 409) {
				toast.error(e.response.data.error || 'Workspace already exists');
			} else if (e?.response?.status === 400 && e?.response?.data?.error?.includes('rank')) {
				methods.setError("groupid", { 
					type: "custom", 
					message: "You must be at least rank 10 in this group" 
				});
			} else if (e?.message === 'Request timeout') {
				toast.error('Request timed out. Please try again.');
			} else {
				toast.error('An error occurred. Please try again.');
				console.error('Setup workspace error:', e);
			}
			return;
		} finally {
			setIsLoading(false);
		}
	}

	const nextSlide = () => {
		setSelectedSlide(selectedSlide + 1);
	};

	const colors = [
		"bg-pink-100",
		"bg-rose-100",
		"bg-orange-100",
		"bg-amber-100",
		"bg-lime-100",
		"bg-emerald-100",
		"bg-cyan-100",
		"bg-sky-100",
		"bg-indigo-100",
		"bg-purple-100",
		"bg-pink-400",
		"bg-rose-400",
		"bg-orange-400",
		"bg-amber-400",
		"bg-lime-400",
		"bg-emerald-400",
		"bg-cyan-400",
		"bg-sky-400",
		"bg-indigo-400",
		"bg-violet-400",
		"bg-pink-600",
		"bg-rose-600",
		"bg-orange-600",
		"bg-amber-600",
		"bg-lime-600",
		"bg-emerald-600",
		"bg-cyan-600",
		"bg-sky-600",
		"bg-indigo-600",
		"bg-violet-600",
	];

	if (!ready) {
		return (
			<div className="flex h-screen items-center justify-center dark:bg-zinc-900">
				<svg aria-hidden="true" className="w-12 h-12 text-zinc-200 animate-spin dark:text-zinc-600 fill-firefli" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
					<path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
				</svg>
			</div>
		);
	}

	return (
		<div className="relative flex h-screen overflow-hidden">
			<canvas
				ref={canvasRef}
				className="absolute inset-0 w-full h-full"
				style={{ zIndex: 0 }}
			/>
			<div className="relative z-10 flex w-full h-full">
				<p className="text-md -mt-1 text-white absolute top-4 left-4 xs:hidden md:text-6xl font-extrabold">
					👋 Welcome <br /> to <span className="text-pink-100 "> Firefli </span>
				</p>
				<Slider activeSlide={selectedSlide}>
				<div>
					<p className="font-bold text-2xl dark:text-white">Let's get started</p>
					<p className="text-md -mt-1 text-zinc-500 dark:text-zinc-200">
						To configure your Firefli instance, we'll need some information
					</p>
					<FormProvider {...methods}>
						<form className="mt-2" onSubmit={handleSubmit(nextSlide)}>
							<Input
								placeholder="752856518"
								label="Group ID"
								id="groupid"
								{...register("groupid", { 
									required: { 
										value: true, 
										message: "This field is required" 
									},
									pattern: {
										value: /^\d+$/,
										message: "Group ID must be a number"
									}
								})}
							/>
						</form>
					</FormProvider>

					<div className="mt-7">
						<label className="text-zinc-500 text-sm dark:text-zinc-200">Color</label>
						<div className="grid grid-cols-10 gap-3 mt-2 mb-8">
							{colors.map((color, i) => (
								<button
									key={i}
									type="button"
									onClick={() => setSelectedColor(color)}
									className={`aspect-square rounded-lg transform transition-all ease-in-out ${color} ${
										selectedColor === color ? "ring-4 ring-black dark:ring-white ring-offset-2" : "hover:scale-105"
									}`}
								/>
							))}
						</div>
					</div>
					<div className="mb-6">
						<label className="text-zinc-500 text-sm dark:text-zinc-200 font-medium">
							Roblox Open Cloud API Key <span className="text-red-500">*</span>
						</label>
						<p className="text-xs text-zinc-400 dark:text-zinc-400 mt-1 mb-2">
							Required for group member sync. Create one at{" "}
							<a
								href="https://create.roblox.com/credentials"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-500 hover:underline"
							>
								create.roblox.com/credentials
							</a>
							{" "}with <strong>Group</strong> API system and <strong>Read</strong> access for your group.
						</p>
						<div className="flex gap-2">
							<input
								type="password"
								value={robloxApiKey}
								onChange={(e) => {
									setRobloxApiKey(e.target.value);
									setApiKeyStatus("idle");
									setApiKeyMessage("");
								}}
								placeholder="Enter your Open Cloud API key"
								className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-firefli"
							/>
							<button
								type="button"
								onClick={testApiKey}
								disabled={!robloxApiKey || !methods.getValues("groupid") || apiKeyStatus === "testing"}
								className="px-4 py-2 text-sm font-medium rounded-lg bg-firefli text-white hover:bg-firefli/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
							>
								{apiKeyStatus === "testing" ? (
									<IconLoader2 size={16} className="animate-spin" />
								) : (
									"Test Key"
								)}
							</button>
						</div>
						{apiKeyStatus === "valid" && (
							<div className="flex items-center gap-1.5 mt-2 text-sm text-green-600 dark:text-green-400">
								<IconCheck size={16} />
								<span>{apiKeyMessage}</span>
							</div>
						)}
						{apiKeyStatus === "invalid" && (
							<div className="flex items-center gap-1.5 mt-2 text-sm text-red-500">
								<IconX size={16} />
								<span>{apiKeyMessage}</span>
							</div>
						)}
					</div>

					<div className="flex">
						<button 
							type="button"
							onClick={() => window.open("https://docs.firefli.net/", "_blank", "noopener,noreferrer")}
							className="border-firefli border-2 py-3 text-sm rounded-xl px-6 text-zinc-600 dark:text-white font-bold hover:bg-firefli/80 dark:hover:bg-blue-400 transition"
						>
							Documentation
						</button>
						<button
							type="button"
							onClick={() => {
								if (apiKeyStatus !== "valid") {
									toast.error("Please test and validate your Roblox Open Cloud API key first.");
									return;
								}
								if (useCreateWs) {
									if (!canCreateAdditional) {
										toast.error('You do not have permission to create additional workspaces.');
										return;
									}
									handleSubmit(
										createAccount,
										() => toast.error('Please enter a valid Group ID')
									)();
								} else {
									handleSubmit(nextSlide)();
								}
							}}
							className={`ml-auto py-3 text-sm rounded-xl px-6 text-white font-bold transition ${
								apiKeyStatus === "valid"
									? "bg-firefli hover:bg-firefli/80"
									: "bg-zinc-400 dark:bg-zinc-600 cursor-not-allowed"
							}`}
							disabled={isLoading || apiKeyStatus !== "valid" || (useCreateWs && !canCreateAdditional)}
						>
							{isLoading ? 'Creating...' : (useCreateWs ? 'Create Workspace' : 'Continue')}
						</button>
					</div>
				</div>
				<div>
					<p className="font-bold text-2xl dark:text-white" id="2">
						Make your Firefli account
					</p>
					<p className="text-md -mt-1 text-zinc-500 dark:text-zinc-200">
						You need to create a Firefli account to continue
					</p>
					<FormProvider {...signupform}>
						<form onSubmit={signupform.handleSubmit(createAccount)}>
							<Input 
								{...signupform.register("username", {
									required: "Username is required"
								})} 
								label="Roblox Username" 
							/>
							{signupform.formState.errors.username && (
								<p className="text-red-500 text-sm mt-1">
									{signupform.formState.errors.username.message}
								</p>
							)}
							
							<Input 
								type="password" 
								{...signupform.register("password", { 
									required: "Password is required",
									minLength: {
										value: 8,
										message: "Password must be at least 8 characters"
									}
								})} 
								label="Password" 
							/>
							{signupform.formState.errors.password && (
								<p className="text-red-500 text-sm mt-1">
									{signupform.formState.errors.password.message}
								</p>
							)}
							
							<Input 
								type="password" 
								{...signupform.register("verifypassword", { 
									required: "Please verify your password",
									validate: value => 
										value === signupform.getValues('password') || 
										"Passwords do not match"
								})} 
								label="Verify password" 
							/>
							{signupform.formState.errors.verifypassword && (
								<p className="text-red-500 text-sm mt-1">
									{signupform.formState.errors.verifypassword.message}
								</p>
							)}
						</form>
					</FormProvider>

					<div className="mt-7 flex">
						<button
							type="button"
							onClick={() => setSelectedSlide(0)}
							className="bg-firefli ml-auto py-3 text-sm rounded-xl px-6 text-white font-bold hover:bg-firefli/80 transition"
						>
							Back
						</button>
						<button
							type="button"
							onClick={signupform.handleSubmit(createAccount)}
							disabled={isLoading}
							className={`ml-4 bg-firefli py-3 text-sm rounded-xl px-6 text-white font-bold hover:bg-firefli/80 transition ${
								isLoading ? 'opacity-50 cursor-not-allowed' : ''
							}`}
						>
							{isLoading ? 'Creating...' : 'Continue'}
						</button>
					</div>
				</div>
			</Slider>
			</div>
		</div>
	);
};

export default Login;
