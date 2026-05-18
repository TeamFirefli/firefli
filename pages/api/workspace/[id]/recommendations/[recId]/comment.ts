import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { getUsername, getThumbnail } from "@/utils/userinfoEngine";
import sanitizeHtml from "sanitize-html";
import { fileTypeFromBuffer } from "file-type";
import isSvg from "is-svg";
import sharp from "sharp";
import { getConfig } from "@/utils/configEngine";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function validateAndSanitizeImage(dataUrl: string): Promise<string> {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid image format");
  }

  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid data URL format");

  const [, mimeType, base64Data] = matches;
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) throw new Error("Unsupported image type");

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > MAX_FILE_SIZE) throw new Error("Image too large. Maximum size is 5MB.");

  const fileType = await fileTypeFromBuffer(new Uint8Array(buffer));
  if (!fileType) {
    if (isSvg(buffer.toString())) throw new Error("SVG images are not supported");
    throw new Error("Unable to determine image type");
  }

  if (!ALLOWED_MIME_TYPES.includes(fileType.mime)) throw new Error("Image type mismatch");
  if (fileType.mime !== mimeType) throw new Error("Image type doesn't match claimed type");

  let processedImageBuffer: Buffer;
  if (mimeType === "image/jpeg") {
    processedImageBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
  } else if (mimeType === "image/png") {
    processedImageBuffer = await sharp(buffer).png({ compressionLevel: 9 }).toBuffer();
  } else if (mimeType === "image/webp") {
    processedImageBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  } else if (mimeType === "image/gif") {
    processedImageBuffer = await sharp(buffer, { animated: true }).toFormat("png").toBuffer();
    return `data:image/png;base64,${processedImageBuffer.toString("base64")}`;
  } else {
    throw new Error("Unsupported image format");
  }

  return `data:${mimeType};base64,${processedImageBuffer.toString("base64")}`;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const workspaceGroupId = parseInt(req.query.id as string);
  const config = await getConfig('recommendations', workspaceGroupId);
  if (!config || !config.enabled) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  const userId = req.session.userid;
  if (!userId) {
    return res.status(401).json({ success: false, error: "Not logged in" });
  }

  const recId = req.query.recId as string;

  const recommendation = await prisma.recommendation.findFirst({
    where: { id: recId, workspaceGroupId },
  });

  if (!recommendation) {
    return res.status(404).json({ success: false, error: "Not found" });
  }

  let { content, image } = req.body;
  if (!content && !image) {
    return res.status(400).json({ success: false, error: "Missing content" });
  }

  content = content ? sanitizeHtml(content.toString().trim(), {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: ["style", "script", "textarea", "option", "xmp"],
  }) : "";

  if (content.length > 5000) {
    return res.status(400).json({ success: false, error: "Comment too long" });
  }

  if (image) {
    try {
      image = await validateAndSanitizeImage(image);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Invalid image",
      });
    }
  }

  let authorName: string | null = null;
  let authorPicture: string | null = null;
  try {
    authorName = await getUsername(Number(userId));
    authorPicture = await getThumbnail(Number(userId));
  } catch {}

  const comment = await prisma.recommendationComment.create({
    data: {
      recommendationId: recId,
      authorId: BigInt(userId),
      authorName,
      authorPicture,
      content: content || "",
      image: image || undefined,
    },
  });

  const serialized = JSON.parse(
    JSON.stringify(comment, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return res.status(200).json({ success: true, comment: serialized });
}

export default withPermissionCheck(handler, "comment_recommendations");
