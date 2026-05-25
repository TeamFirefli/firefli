import Parser from "rss-parser";
import packageJson from "../../package.json";

const extractVersion = (title) => {
	const match = title.match(/v?(\d+\.\d+\.\d+)/i);
	return match ? match[1] : null;
};

const isVersionLessThanOrEqual = (v1, v2) => {
	const parts1 = v1.split(".").map(Number);
	const parts2 = v2.split(".").map(Number);
	
	for (let i = 0; i < 3; i++) {
		if (parts1[i] > parts2[i]) return false;
		if (parts1[i] < parts2[i]) return true;
	}
	return true;
};

const HEX_COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const sanitizeColor = (color) => (HEX_COLOR_RE.test(color ?? "") ? color : "#6b7280");

export default async function handler(req, res) {
	const FEED_URL = "https://cl1.firefli.net/changelog/cmkvbgjd2001888v9k9z2bs8f/rss.xml";
	try {
		const parser = new Parser({
			customFields: {
				item: [["changerawr:tag", "changerawr:tag", { keepArray: true }]],
			},
		});
		const feed = await parser.parseURL(FEED_URL);
		const currentVersion = packageJson.version;
		
		const items = (feed.items || [])
			.map((item) => {
				const rawTags = item["changerawr:tag"] || [];
				const categories = rawTags
					.map((tag) => ({
						name: String(tag?.$ ?.name || "").trim(),
						color: sanitizeColor(tag?.$ ?.color),
					}))
					.filter((t) => t.name);
				if (!categories.length && Array.isArray(item.categories)) {
					item.categories.forEach((c) => {
						if (c) categories.push({ name: String(c).trim(), color: "#6b7280" });
					});
				}

				return {
					title: item.title || "",
					pubDate: item.pubDate || item.isoDate || "",
					content: item["content:encoded"] || item.content || "",
					version: extractVersion(item.title || "") || null,
					categories,
				};
			})
			.filter((item) => {
				const itemVersion = extractVersion(item.title);
				if (!itemVersion) return true;
				return isVersionLessThanOrEqual(itemVersion, currentVersion);
			});

		const metaMode = req.query && (req.query.meta === "1" || req.query.meta === "true");
		res.setHeader("Content-Type", "application/json");
		if (metaMode) {
			const channel = {
				title: feed.title || "",
				description: feed.description || "",
				lastBuildDate: feed.lastBuildDate || "",
			};
			return res.status(200).json({ channel, items });
		}
		return res.status(200).json(items);
	} catch (err) {
		const metaMode = req.query && (req.query.meta === "1" || req.query.meta === "true");
		res.setHeader("Content-Type", "application/json");
		if (metaMode) return res.status(200).json({ channel: null, items: [] });
		return res.status(200).json([]);
	}
}