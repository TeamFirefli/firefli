import axios from "axios";
import React, { useState } from "react";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";
import moment from "moment";
import Button from "@/components/button";
import type { wallPost } from "@/utils/database";
import { useRouter } from "next/router";
import { IconChevronRight, IconMessage } from '@tabler/icons-react'
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

const BG_COLORS = [
  "bg-amber-200",
  "bg-red-300",
  "bg-lime-200",
  "bg-emerald-300",
  "bg-rose-200",
  "bg-green-100",
  "bg-teal-200",
  "bg-yellow-200",
  "bg-red-100",
  "bg-green-300",
  "bg-lime-300",
  "bg-emerald-200",
  "bg-rose-300",
  "bg-amber-300",
  "bg-red-200",
  "bg-green-200",
];


function getRandomBg(userid: number | string, username?: string) {
	const key = `${userid ?? ""}:${username ?? ""}`;
	let hash = 5381;
	for (let i = 0; i < key.length; i++) {
		hash = ((hash << 5) - hash) ^ key.charCodeAt(i);
	}
	const index = (hash >>> 0) % BG_COLORS.length;
	return BG_COLORS[index];
}

type WallPostWithAuthor = wallPost & {
	author: {
		userid: string;
		username: string | null;
		picture: string | null;
		rankId?: number | null;
		rankName?: string | null;
		departments?: Array<{
			id: string;
			name: string;
			color: string | null;
		}>;
	};
	reactions?: Array<{
		emoji: string;
		userId: string;
	}>;
};

const getReactionCounts = (post: WallPostWithAuthor) => {
	const counts = new Map<string, number>();
	for (const reaction of post.reactions || []) {
		counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
	}
	return Array.from(counts.entries())
		.map(([emoji, count]) => ({ emoji, count }))
		.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
};

const Wall: React.FC = () => {
	const [posts, setPosts] = useState<WallPostWithAuthor[]>([]);
	const router = useRouter();
	React.useEffect(() => {
		axios.get(`/api/workspace/${router.query.id}/home/wall`).then(res => {
			if (res.status === 200) {
				setPosts(res.data.posts)
			}
		})
	}, []);

	const goToWall = () => {
		router.push(`/workspace/${router.query.id}/wall`)
	}

	return (
		<div className="flex flex-col gap-4 h-full">
			{posts.length === 0 ? (
				<div className="flex flex-col items-center justify-center h-full text-center">
					<div className="w-[clamp(2rem,15cqh,4rem)] h-[clamp(2rem,15cqh,4rem)] rounded-full bg-primary/10 flex items-center justify-center mb-[clamp(0.5rem,4cqh,1rem)]">
						<IconMessage className="w-[clamp(1rem,8cqh,2rem)] h-[clamp(1rem,8cqh,2rem)] text-primary" />
					</div>
					<p className="text-[clamp(0.875rem,5cqh,1.125rem)] font-medium text-zinc-900 dark:text-white mb-1">No posts yet</p>
					<p className="text-[clamp(0.75rem,3.5cqh,0.875rem)] text-zinc-500 dark:text-zinc-400">Be the first to share something with your workspace</p>
				</div>
			) : (
				<div className="flex flex-col gap-4">
					{posts.slice(0, 2).map((post) => (
						<div 
							key={post.id} 
							className="rounded-xl border border-zinc-100 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-900/50"
						>
							<div className="flex items-start gap-3">
								<div 
									className={`rounded-lg h-10 w-10 flex items-center justify-center ${getRandomBg(post.author.userid|| '')}`}
								>
									<img 
										alt={`${post.author.username}'s avatar`} 
										src={String(post.author.picture)} 
										className="rounded-lg h-10 w-10 object-cover border-2 border-white dark:border-zinc-800" 
									/>
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<p className="font-medium text-zinc-900 dark:text-white truncate">
											{post.author.username}
										</p>
										{post.author.departments && post.author.departments.length > 0 && (
											<span 
												className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full text-white font-medium whitespace-nowrap"
												style={{ backgroundColor: post.author.departments[0].color || '#3b82f6' }}
											>
												{post.author.departments[0].name}
											</span>
										)}
									</div>
									{post.author.rankName && (
										<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
											{post.author.rankName}
										</p>
									)}
									<div className="prose text-zinc-800 dark:text-zinc-200 dark:prose-invert max-w-none mt-1">
										<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{post.content}</ReactMarkdown>
									</div>
									{post.image && (
										<div className="mt-3">
											<img 
												src={post.image} 
												alt="Post image" 
												className="rounded-lg max-h-48 w-full object-cover"
											/>
										</div>
									)}
									<div className="mt-3 flex items-center justify-between gap-3">
										<p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
											<span className="sm:hidden">
												{moment(post.createdAt).format("DD/MM/YYYY h:mm A")}
											</span>
											<span className="hidden sm:inline">
												{moment(post.createdAt).format("MMMM D, YYYY [at] h:mm A")}
											</span>
										</p>
										{getReactionCounts(post).length > 0 && (
											<div className="inline-flex items-center gap-1.5">
												{getReactionCounts(post).map(({ emoji, count }) => (
													<div
														key={`${post.id}-${emoji}`}
														className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-zinc-50 dark:bg-zinc-700/40 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
													>
														<span>{emoji}</span>
														<span className="text-xs font-medium">{count}</span>
													</div>
												))}
											</div>
										)}
									</div>
								</div>
							</div>
						</div>
					))}
					<button
						onClick={goToWall}
						className="inline-flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
					>
						View all posts
						<IconChevronRight className="w-4 h-4" />
					</button>
				</div>
			)}
		</div>
	)
};

export default Wall;
