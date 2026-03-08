import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { validateApiKey } from "@/utils/api-auth";
import { withPublicApiRateLimit } from "@/utils/prtl";
import { logAudit } from "@/utils/logs";
import { getRankingProvider } from "@/utils/rankgun";
import * as noblox from "noblox.js";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey)
    return res.status(401).json({ success: false, error: "Missing API key" });

  const workspaceId = Number.parseInt(req.query.id as string);
  if (!workspaceId)
    return res
      .status(400)
      .json({ success: false, error: "Missing workspace ID" });

  try {
    const key = await validateApiKey(apiKey, workspaceId);
    if (!key) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired API key" });
    }

    const { userId, reason } = req.body;

    if (!userId || !reason) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, reason",
      });
    }

    const numericUserId = Number.parseInt(String(userId));
    if (isNaN(numericUserId)) {
      return res
        .status(400)
        .json({ success: false, error: "userId must be a valid number" });
    }

    const adminId = BigInt(key.createdById);

    if (BigInt(numericUserId) === adminId) {
      return res.status(400).json({
        success: false,
        error: "You cannot perform actions on yourself.",
      });
    }

    const [targetUserRankCheck, adminUserRankCheck] = await Promise.all([
      prisma.rank.findFirst({
        where: { userId: BigInt(numericUserId), workspaceGroupId: workspaceId },
      }),
      prisma.rank.findFirst({
        where: { userId: adminId, workspaceGroupId: workspaceId },
      }),
    ]);

    if (targetUserRankCheck && adminUserRankCheck) {
      const storedTargetRank = Number(targetUserRankCheck.rankId);
      const storedAdminRank = Number(adminUserRankCheck.rankId);
      let targetRankNum = storedTargetRank;
      let adminRankNum = storedAdminRank;

      if (storedTargetRank > 255 || storedAdminRank > 255) {
        try {
          const robloxRoles = await noblox.getRoles(workspaceId);
          const roleIdToRank = new Map<number, number>();
          robloxRoles.forEach((role) => { roleIdToRank.set(role.id, role.rank); });
          if (storedTargetRank > 255) targetRankNum = roleIdToRank.get(storedTargetRank) ?? storedTargetRank;
          if (storedAdminRank > 255) adminRankNum = roleIdToRank.get(storedAdminRank) ?? storedAdminRank;
        } catch (e) {
          console.error("Failed to resolve Roblox role IDs to rank values:", e);
        }
      }

      if (targetRankNum >= adminRankNum) {
        const adminMember = await prisma.workspaceMember.findFirst({
          where: { userId: adminId, workspaceGroupId: workspaceId, isAdmin: true },
        });
        if (!adminMember) {
          return res.status(403).json({
            success: false,
            error: "You cannot perform actions on users with equal or higher rank than yours.",
          });
        }
      }
    }

    let rankBefore: number | null = null;
    let rankAfter: number | null = null;
    let rankNameBefore: string | null = null;
    let rankNameAfter: string | null = null;

    const rankingProvider = await getRankingProvider(workspaceId);

    if (rankingProvider) {
      try {
        const targetUserRank = await prisma.rank.findFirst({
          where: {
            userId: BigInt(numericUserId),
            workspaceGroupId: workspaceId,
          },
        });

        if (targetUserRank) {
          rankBefore = Number(targetUserRank.rankId);

          if (rankingProvider.type === "roblox_cloud") {
            try {
              const { RobloxCloudRankingAPI, getWorkspaceRobloxApiKey } =
                await import("@/utils/openCloud");
              const robloxApiKey = await getWorkspaceRobloxApiKey(workspaceId);
              if (robloxApiKey) {
                const cloudApi = new RobloxCloudRankingAPI(
                  robloxApiKey,
                  workspaceId,
                );
                const roles = await cloudApi.getGroupRoles();
                const roleInfo = roles.find((r) => r.rank === rankBefore);
                rankNameBefore = roleInfo?.name || null;
              }
            } catch {
              try {
                const currentRankInfo = await noblox.getRole(
                  workspaceId,
                  rankBefore,
                );
                rankNameBefore = currentRankInfo?.name || null;
              } catch {}
            }
          } else {
            try {
              const currentRankInfo = await noblox.getRole(
                workspaceId,
                rankBefore,
              );
              rankNameBefore = currentRankInfo?.name || null;
            } catch {}
          }
        }
      } catch (error) {
        console.error("[Public API] Error getting current rank:", error);
      }

      try {
        const result = await rankingProvider.terminateUser(numericUserId);

        if (result && !result.success) {
          let errorMessage = result.error || "Termination failed.";
          if (typeof errorMessage === "object") {
            try {
              errorMessage = JSON.stringify(errorMessage);
            } catch {
              errorMessage = String(errorMessage);
            }
          }
          return res
            .status(400)
            .json({ success: false, error: String(errorMessage) });
        }

        // Remove user from Firefli workspace roles
        if (result?.success) {
          const currentUser = await prisma.user.findFirst({
            where: { userid: BigInt(numericUserId) },
            include: {
              roles: { where: { workspaceGroupId: workspaceId } },
            },
          });

          if (currentUser && currentUser.roles.length > 0) {
            for (const role of currentUser.roles) {
              await prisma.user.update({
                where: { userid: BigInt(numericUserId) },
                data: { roles: { disconnect: { id: role.id } } },
              });
            }
          }
        }

        try {
          let newRank: number = 0;
          let newRankName: string | null = null;
          let newRolesetId: number | null = null;

          if (rankingProvider.type === "roblox_cloud") {
            const { RobloxCloudRankingAPI, getWorkspaceRobloxApiKey } =
              await import("@/utils/openCloud");
            const robloxApiKey = await getWorkspaceRobloxApiKey(workspaceId);
            if (robloxApiKey) {
              const cloudApi = new RobloxCloudRankingAPI(
                robloxApiKey,
                workspaceId,
              );
              const membership =
                await cloudApi.getUserMembership(numericUserId);
              if (membership) {
                newRank = membership.rank;
                const roles = await cloudApi.getGroupRoles();
                const roleInfo = roles.find((r) => r.rank === membership.rank);
                newRankName = roleInfo?.name || null;
                newRolesetId = roleInfo?.id || null;
              }
            } else {
              newRank = await noblox.getRankInGroup(workspaceId, numericUserId);
              const newRankInfo = await noblox.getRole(workspaceId, newRank);
              newRankName = newRankInfo?.name || null;
              newRolesetId = newRankInfo?.id || null;
            }
          } else {
            newRank = await noblox.getRankInGroup(workspaceId, numericUserId);
            const newRankInfo = await noblox.getRole(workspaceId, newRank);
            newRankName = newRankInfo?.name || null;
            newRolesetId = newRankInfo?.id || null;
          }

          rankAfter = newRank;
          rankNameAfter = newRankName;
          let rolesetIdForSync = newRolesetId;
          if (!rolesetIdForSync) {
            try {
              const fallbackInfo = await noblox.getRole(workspaceId, newRank);
              rolesetIdForSync = fallbackInfo?.id || null;
            } catch {}
          }
          const rankIdToStore = rolesetIdForSync || newRank;
          await prisma.rank.upsert({
            where: {
              userId_workspaceGroupId: {
                userId: BigInt(numericUserId),
                workspaceGroupId: workspaceId,
              },
            },
            update: { rankId: BigInt(rankIdToStore) },
            create: {
              userId: BigInt(numericUserId),
              workspaceGroupId: workspaceId,
              rankId: BigInt(rankIdToStore),
            },
          });

          if (rolesetIdForSync) {
            const role = await prisma.role.findFirst({
              where: {
                workspaceGroupId: workspaceId,
                groupRoles: { hasSome: [rolesetIdForSync] },
              },
            });

            if (role) {
              const currentUser = await prisma.user.findFirst({
                where: { userid: BigInt(numericUserId) },
                include: {
                  roles: { where: { workspaceGroupId: workspaceId } },
                },
              });

              if (currentUser && currentUser.roles.length > 0) {
                for (const oldRole of currentUser.roles) {
                  await prisma.user.update({
                    where: { userid: BigInt(numericUserId) },
                    data: { roles: { disconnect: { id: oldRole.id } } },
                  });
                }
              }

              await prisma.user.update({
                where: { userid: BigInt(numericUserId) },
                data: { roles: { connect: { id: role.id } } },
              });
            }
          }
        } catch (rankUpdateError) {
          console.error(
            "[Public API] Error updating user rank in database:",
            rankUpdateError,
          );
        }
      } catch (error: any) {
        let errorMessage =
          error?.response?.data?.error ||
          error?.message ||
          "Termination failed";
        if (typeof errorMessage === "object") {
          try {
            errorMessage = JSON.stringify(errorMessage);
          } catch {
            errorMessage = String(errorMessage);
          }
        }
        return res
          .status(500)
          .json({ success: false, error: String(errorMessage) });
      }
    }

    const userbook = await prisma.userBook.create({
      data: {
        userId: BigInt(numericUserId),
        type: "termination",
        workspaceGroupId: workspaceId,
        reason,
        adminId,
        rankBefore,
        rankAfter,
        rankNameBefore,
        rankNameAfter,
      },
      include: { admin: true },
    });

    try {
      await logAudit(
        workspaceId,
        Number(adminId),
        "userbook.create",
        `userbook:${userbook.id}`,
        {
          type: "termination",
          userId: numericUserId,
          adminId: Number(adminId),
          reason,
          rankBefore,
          rankAfter,
          rankNameBefore,
          rankNameAfter,
          source: "public_api",
        },
      );
    } catch {}

    return res.status(201).json({
      success: true,
      entry: JSON.parse(
        JSON.stringify(userbook, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      ),
      terminated: true,
    });
  } catch (error) {
    console.error("[Public API] Error creating termination entry:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export default withPublicApiRateLimit(handler);