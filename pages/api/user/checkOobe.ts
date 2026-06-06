import type { NextApiRequest, NextApiResponse } from "next"
import { withSessionRoute } from "@/lib/withSession"
import prisma from "@/utils/database"

type Data = {
  success: boolean
  error?: string
  oobe?: boolean
}

export default withSessionRoute(handler)

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" })
  if (!req.session.userid) return res.status(401).json({ success: false, error: "Not logged in" })

  try {
	const user = await prisma.user.findUnique({
	  where: {
		userid: req.session.userid,
	  },
	  select: {
		setOOBE: true,
	  },
	}) 

	if (!user) {
	  return res.status(404).json({ success: false, error: "User not found" })
	}

	// Before returning it, update the registry.
	const updateUser = await prisma.user.update({
  		where: { userid: req.session.userid },
  		data: { setOOBE: true, },
	});

	let returns 

	if (user.setOOBE == null) {
		returns = false
	} else {
		returns = user.setOOBE
	}
	
	return res.status(200).json({ success: true, oobe: returns})

  } catch (error) {
	console.error("Error checking OOBE status: ", error)
	return res.status(500).json({ success: false, error: "Internal server error" })
  }
}
