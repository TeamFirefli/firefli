import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

type Data = {
	latestVersion: string;
	needsUpdate: boolean;
	currentVersion: string;
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	let Latest = '0'
	let axiosNV = await axios.get(`https://raw.githubusercontent.com/TeamFirefli/firefli/refs/heads/main/package.json`).then(res => {
		Latest = res.data.version
	});
	const pkj = require('@/package.json')
	let ver = pkj.version

	if (ver < Latest) {
		// Outdated!
		res.status(200).json({ needsUpdate: true, latestVersion: Latest, currentVersion: ver })
	}

	res.status(200).json({ needsUpdate: false, latestVersion: Latest, currentVersion: ver })
}
