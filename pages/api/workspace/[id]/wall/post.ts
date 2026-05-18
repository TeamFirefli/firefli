// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { fetchworkspace, getConfig, setConfig } from "@/utils/configEngine";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { withSessionRoute } from "@/lib/withSession";
import { logAudit } from "@/utils/logs";
import {
  getUsername,
  getThumbnail,
  getDisplayName,
} from "@/utils/userinfoEngine";
import { getGroupRoles } from "@/utils/roblox";
import sanitizeHtml from "sanitize-html";
import { fileTypeFromBuffer } from "file-type";
import isSvg from "is-svg";
import sharp from "sharp";

type Data = {
  success: boolean;
  error?: string;
  post?: any;
};

export default withPermissionCheck(handler, "post_on_wall");

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Max file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Validates and sanitizes an image
 * @param dataUrl Data URL containing the image
 * @returns Sanitized data URL or throws an error
 */
async function validateAndSanitizeImage(dataUrl: string): Promise<string> {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid image format");
  }

  // Extract base64 data and MIME type
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid data URL format");
  }

  const [, mimeType, base64Data] = matches;

  // Check if MIME type is allowed
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error("Unsupported image type");
  }

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, "base64");

  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("Image too large. Maximum size is 5MB.");
  }

  // Detect actual file type using file-type package
  const fileType = await fileTypeFromBuffer(new Uint8Array(buffer));

  // If file type detection fails or doesn't match claimed type, check if it's SVG
  if (!fileType) {
    if (isSvg(buffer.toString())) {
      throw new Error("SVG images are not supported");
    }
    throw new Error("Unable to determine image type");
  }

  // Verify that detected type matches claimed type
  if (!ALLOWED_MIME_TYPES.includes(fileType.mime)) {
    throw new Error("Image type mismatch");
  }

  // Check if claimed MIME type matches actual MIME type
  if (fileType.mime !== mimeType) {
    throw new Error("Image type doesn't match claimed type");
  }

  // Process with sharp to sanitize the image by fully re-encoding it
  try {
    let processedImageBuffer: Buffer;

    if (mimeType === "image/jpeg") {
      processedImageBuffer = await sharp(buffer)
        .jpeg({ quality: 85 })
        .toBuffer();
    } else if (mimeType === "image/png") {
      processedImageBuffer = await sharp(buffer)
        .png({ compressionLevel: 9 })
        .toBuffer();
    } else if (mimeType === "image/webp") {
      processedImageBuffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();
    } else if (mimeType === "image/gif") {
      processedImageBuffer = await sharp(buffer, { animated: true })
        .toFormat("png")
        .toBuffer();
      return `data:image/png;base64,${processedImageBuffer.toString("base64")}`;
    } else {
      throw new Error("Unsupported image format");
    }

    return `data:${mimeType};base64,${processedImageBuffer.toString("base64")}`;
  } catch (error) {
    console.error("Image processing error:", error);
    throw new Error("Failed to process image");
  }
}

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  if (!req.session.userid)
    return res.status(401).json({ success: false, error: "Not logged in" });
  if (!req.body?.content && !req.body?.image)
    return res.status(400).json({ success: false, error: "Missing content" });

  try {
    let { content, image } = req.body;
    content = content || "";

    // Sanitize text content - strip all HTML tags
    content = sanitizeHtml(content.toString().trim(), {
      allowedTags: [],
      allowedAttributes: {},
      nonTextTags: ["style", "script", "textarea", "option", "xmp"],
    });

    // Truncate overly long content
    const MAX_CONTENT_LENGTH = 10000;
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.substring(0, MAX_CONTENT_LENGTH);
    }

    // Validate and sanitize image (if present)
    if (image) {
      const workspaceId = parseInt(req.query.id as string);
      const user = await prisma.user.findFirst({
        where: { userid: BigInt(req.session.userid) },
        include: {
          roles: {
            where: { workspaceGroupId: workspaceId },
          },
          workspaceMemberships: {
            where: { workspaceGroupId: workspaceId },
          },
        },
      });

      const isAdmin = user?.workspaceMemberships?.[0]?.isAdmin || false;
      const hasPhotoPermission = 
        isAdmin || 
        user?.roles?.[0]?.permissions?.includes("add_wall_photos");

      if (!hasPhotoPermission) {
        return res.status(403).json({
          success: false,
          error: "You don't have permission to add photos to wall posts",
        });
      }

      try {
        image = await validateAndSanitizeImage(image);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : "Invalid image",
        });
      }
    }

    const workspaceGroupId = parseInt(req.query.id as string);
    
    const post = await prisma.wallPost.create({
      data: {
        content,
        image: image || undefined,
        authorId: req.session.userid,
        workspaceGroupId: workspaceGroupId,
      },
      include: {
        author: {
          select: {
            userid: true,
            username: true,
            picture: true,
            ranks: {
              where: {
                workspaceGroupId: workspaceGroupId
              }
            },
            workspaceMemberships: {
              where: {
                workspaceGroupId: workspaceGroupId
              },
              include: {
                departmentMembers: {
                  include: {
                    department: {
                      select: {
                        id: true,
                        name: true,
                        color: true
                      }
                    }
                  }
                }
              }
            }
          },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
      },
    });

    const workspace = await prisma.workspace.findUnique({
      where: { groupId: workspaceGroupId }
    });
    
    const roleIdToInfoMap = new Map<number, { rank: number; name: string }>();
    const rolesByRank: any[] = [];
    
    if (workspace) {
      const roles = await getGroupRoles(Number(workspace.groupId));
      roles.sort((a, b) => a.rank - b.rank);
      rolesByRank.push(...roles);
      roles.forEach(role => {
        roleIdToInfoMap.set(role.id, { rank: role.rank, name: role.name });
      });
    }
    
    const rank = post.author.ranks?.[0];
    let rankName = null;
    
    if (rank) {
      const storedValue = Number(rank.rankId);
      if (storedValue > 255) {
        rankName = roleIdToInfoMap.get(storedValue)?.name || null;
      } else {
        const role = rolesByRank.find(r => r.rank === storedValue);
        rankName = role?.name || null;
      }
    }
    
    const departments = post.author.workspaceMemberships?.[0]?.departmentMembers?.map(dm => dm.department) || [];
    
    const postWithDetails = {
      ...post,
      author: {
        userid: post.author.userid,
        username: post.author.username,
        picture: post.author.picture,
        rankId: rank ? Number(rank.rankId) : null,
        rankName,
        departments
      }
    };

    // Log audit event for wall post creation
    logAudit(
      workspaceGroupId,
      req.session.userid,
      'wall.post.create',
      'wall',
      {
        content: content.length > 100 ? content.substring(0, 100) + '...' : content,
        hasImage: !!image,
      }
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      post: JSON.parse(
        JSON.stringify(postWithDetails, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      ),
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Something went wrong" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};
