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

export default async function handler(req, res) {
	const FEED_URL = "https://cl.firefli.net/changelog/cmkvbgjd2001888v9k9z2bs8f/rss.xml";
	try {
		const parser = new Parser();
		const feed = await parser.parseURL(FEED_URL);
		const currentVersion = packageJson.version;
		
		const items = (feed.items || [])
			.map((item) => ({
				title: item.title || "",
				pubDate: item.pubDate || item.isoDate || "",
				content: item["content:encoded"] || item.content || "",
			}))
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