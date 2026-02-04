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
	}, [mounted]);

	async function createAccount() {
		setIsLoading(true);
		let request: { data: { success: boolean; workspaceGroupId?: number; user?: any } } | undefined;
		
		const isSecondWorkspace = login?.workspaces && login.workspaces.length > 0;
		
		try {
			if (isSecondWorkspace) {
				request = await Promise.race([
					axios.post('/api/createws', {
						groupId: Number(methods.getValues("groupid"))
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
				toast.error('You must be at least rank 10 in this group');
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
							{errors.groupid && (
								<p className="text-red-500 text-sm mt-1">{errors.groupid.message}</p>
							)}
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
								const isSecondWorkspace = login?.workspaces && login.workspaces.length > 0;
								if (isSecondWorkspace) {
									handleSubmit(createAccount)();
								} else {
									handleSubmit(nextSlide)();
								}
							}}
							className="ml-auto bg-firefli py-3 text-sm rounded-xl px-6 text-white font-bold hover:bg-firefli/80 transition"
							disabled={isLoading}
						>
							{isLoading ? 'Creating...' : (login?.workspaces && login.workspaces.length > 0 ? 'Create Workspace' : 'Continue')}
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
