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
		<div className="flex flex-col gap-4">
			{posts.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
						<IconMessage className="w-8 h-8 text-primary" />
					</div>
					<p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">No posts yet</p>
					<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Be the first to share something with your workspace</p>
					<button
						onClick={goToWall}
						className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
					>
						View Wall
						<IconChevronRight className="w-4 h-4" />
					</button>
				</div>
			) : (
				<div className="flex flex-col gap-4">
					{posts.slice(0, 2).map((post) => (
						<div 
							key={post.id} 
							className="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow"
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
												className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
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
									<span className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 block">
										{moment(post.createdAt).format("MMM D")}
									</span>
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
