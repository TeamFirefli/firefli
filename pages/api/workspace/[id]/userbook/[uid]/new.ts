// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { fetchworkspace, getConfig, setConfig } from "@/utils/configEngine";
import prisma, { SessionType, document } from "@/utils/database";
import { logAudit } from "@/utils/logs";
import { withSessionRoute } from "@/lib/withSession";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { RankGunAPI, getRankGun, getRankingProvider } from "@/utils/rankgun";
import { sendBloxlinkNotification } from "@/utils/bloxlink-notification";

import {
  getUsername,
  getThumbnail,
  getDisplayName,
} from "@/utils/userinfoEngine";
import * as noblox from "noblox.js";
type Data = {
  success: boolean;
  error?: string;
  log?: any;
  terminated?: boolean;
};

async function checkPermissionForType(req: NextApiRequest, type: string, workspaceGroupId: number) {
  const permissionMap: Record<string, string> = {
    note: "logbook_note",
    warning: "logbook_warning",
    promotion: "logbook_promotion",
    demotion: "logbook_demotion",
    termination: "logbook_termination",
    resignation: "logbook_resignation",
    rank_change: "logbook_promotion",
  };
  
  const requiredPermission = permissionMap[type];
  if (!requiredPermission) return false;
  
  const user = await prisma.user.findFirst({
    where: { userid: BigInt(req.session.userid) },
    include: {
      roles: { where: { workspaceGroupId } },
      workspaceMemberships: { where: { workspaceGroupId } },
    },
  });
  
  if (!user || !user.roles.length) return false;
  const membership = user.workspaceMemberships[0];
  const isAdmin = membership?.isAdmin || false;
  if (isAdmin) return true;
  
  return user.roles[0].permissions.includes(requiredPermission);
}

async function hasRankUsersPermission(req: NextApiRequest, workspaceGroupId: number): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { userid: BigInt(req.session.userid) },
    include: {
      roles: { where: { workspaceGroupId } },
      workspaceMemberships: { where: { workspaceGroupId } },
    },
  });
  
  if (!user) return false;
  const membership = user.workspaceMemberships[0];
  const isAdmin = membership?.isAdmin || false;
  if (isAdmin) return true;
  
  return user.roles.some(role => role.permissions.includes("rank_users"));
}

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  const { type, notes, targetRole, notifyDiscord, terminationAction, banDeleteDays } = req.body;
  if (!type || !notes)
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });

  if (
    type !== "termination" &&
    type !== "resignation" &&
    type !== "warning" &&
    type !== "promotion" &&
    type !== "demotion" &&
    type !== "note" &&
    type !== "rank_change"
  )
    return res.status(400).json({ success: false, error: "Invalid type" });
  const { uid, id } = req.query;
  if (!uid)
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });

  const workspaceGroupId = parseInt(id as string);
  const hasPermission = await checkPermissionForType(req, type, workspaceGroupId);
  if (!hasPermission) {
    return res.status(403).json({ success: false, error: "Insufficient permissions" });
  }
  const userId = parseInt(uid as string);

  if (BigInt(userId) === req.session.userid) {
    return res.status(400).json({
      success: false,
      error: "You cannot perform actions on yourself.",
    });
  }

  const [targetUserRankCheck, adminUserRankCheck] = await Promise.all([
    prisma.rank.findFirst({
      where: { userId: BigInt(userId), workspaceGroupId },
    }),
    prisma.rank.findFirst({
      where: { userId: BigInt(req.session.userid), workspaceGroupId },
    }),
  ]);

  if (targetUserRankCheck && adminUserRankCheck) {
    const storedTargetRank = Number(targetUserRankCheck.rankId);
    const storedAdminRank = Number(adminUserRankCheck.rankId);
    let targetRankNum = storedTargetRank;
    let adminRankNum = storedAdminRank;

    if (storedTargetRank > 255 || storedAdminRank > 255) {
      try {
        const robloxRoles = await noblox.getRoles(workspaceGroupId);
        const roleIdToRank = new Map<number, number>();
        robloxRoles.forEach((role) => {
          roleIdToRank.set(role.id, role.rank);
        });

        if (storedTargetRank > 255) {
          targetRankNum = roleIdToRank.get(storedTargetRank) ?? storedTargetRank;
        }
        if (storedAdminRank > 255) {
          adminRankNum = roleIdToRank.get(storedAdminRank) ?? storedAdminRank;
        }
      } catch (e) {
        console.error("Failed to resolve Roblox role IDs to rank values:", e);
      }
    }

    if (targetRankNum >= adminRankNum) {
      const adminMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: BigInt(req.session.userid),
          workspaceGroupId,
          isAdmin: true,
        },
      });
      if (!adminMember) {
        return res.status(403).json({
          success: false,
          error:
            "You cannot perform actions on users with equal or higher rank than yours.",
        });
      }
    }
  }

  const rankingProvider = await getRankingProvider(workspaceGroupId);
  const canUseRanking = await hasRankUsersPermission(req, workspaceGroupId);
  let rankBefore: number | null = null;
  let rankAfter: number | null = null;
  let rankNameBefore: string | null = null;
  let rankNameAfter: string | null = null;

  if (
    (rankingProvider && canUseRanking) &&
    (type === "promotion" ||
      type === "demotion" ||
      type === "rank_change" ||
      type === "termination")
  ) {
    try {
      const targetUserRank = await prisma.rank.findFirst({
        where: {
          userId: BigInt(userId),
          workspaceGroupId: workspaceGroupId,
        },
      });

      if (targetUserRank) {
        const storedRankId = Number(targetUserRank.rankId);
        
        if (rankingProvider?.type === "roblox_cloud") {
          try {
            const { RobloxCloudRankingAPI } = await import("@/utils/openCloud");
            const { getWorkspaceRobloxApiKey } = await import("@/utils/openCloud");
            const apiKey = await getWorkspaceRobloxApiKey(workspaceGroupId);
            if (apiKey) {
              const cloudApi = new RobloxCloudRankingAPI(apiKey, workspaceGroupId);
              const roles = await cloudApi.getGroupRoles();
              const roleInfo = storedRankId > 255
                ? roles.find(r => r.id === storedRankId)
                : roles.find(r => r.rank === storedRankId);
              rankBefore = roleInfo?.rank ?? storedRankId;
              rankNameBefore = roleInfo?.name || null;
            } else {
              rankBefore = storedRankId;
            }
          } catch {
            try {
              const robloxRoles = await noblox.getRoles(workspaceGroupId);
              if (storedRankId > 255) {
                const roleInfo = robloxRoles.find(r => r.id === storedRankId);
                rankBefore = roleInfo?.rank ?? storedRankId;
                rankNameBefore = roleInfo?.name || null;
              } else {
                rankBefore = storedRankId;
                const roleInfo = robloxRoles.find(r => r.rank === storedRankId);
                rankNameBefore = roleInfo?.name || null;
              }
            } catch {
              rankBefore = storedRankId;
            }
          }
        } else {
          try {
            const robloxRoles = await noblox.getRoles(workspaceGroupId);
            if (storedRankId > 255) {
              const roleInfo = robloxRoles.find(r => r.id === storedRankId);
              rankBefore = roleInfo?.rank ?? storedRankId;
              rankNameBefore = roleInfo?.name || null;
            } else {
              rankBefore = storedRankId;
              const roleInfo = robloxRoles.find(r => r.rank === storedRankId);
              rankNameBefore = roleInfo?.name || null;
            }
          } catch {
            rankBefore = storedRankId;
          }
        }
      }

      const adminUserRank = await prisma.rank.findFirst({
        where: {
          userId: BigInt(req.session.userid),
          workspaceGroupId: workspaceGroupId,
        },
      });

      if (adminUserRank) {
        const storedAdminRankId = Number(adminUserRank.rankId);
        let adminRankNumber = storedAdminRankId;
        if (storedAdminRankId > 255) {
          try {
            const robloxRoles = await noblox.getRoles(workspaceGroupId);
            const adminRoleInfo = robloxRoles.find(r => r.id === storedAdminRankId);
            adminRankNumber = adminRoleInfo?.rank ?? storedAdminRankId;
          } catch {
            adminRankNumber = storedAdminRankId;
          }
        }
        if (rankBefore && rankBefore >= adminRankNumber) {
          const adminUser = await prisma.user.findFirst({
            where: {
              userid: BigInt(req.session.userid),
            },
            include: {
              workspaceMemberships: {
                where: {
                  workspaceGroupId: workspaceGroupId,
                },
              },
            },
          });

          const adminMembership = adminUser?.workspaceMemberships[0];
          const isAdmin = adminMembership?.isAdmin || false;
          if (!isAdmin) {
            return res.status(403).json({
              success: false,
              error:
                "You cannot perform ranking actions on users with equal or higher rank than yours",
            });
          }
        }
      }
    } catch (error) {
      console.error("Error getting current rank:", error);
    }
  }

  if (
    rankingProvider &&
    canUseRanking &&
    (type === "promotion" ||
      type === "demotion" ||
      type === "rank_change" ||
      type === "termination" ||
      type === "resignation")
  ) {
    let result;

    try {
      switch (type) {
        case "promotion":
          result = await rankingProvider.promoteUser(userId);
          break;
        case "demotion":
          result = await rankingProvider.demoteUser(userId);
          break;
        case "termination":
          result = await rankingProvider.terminateUser(userId);
          break;
        case "resignation":
          result = await rankingProvider.terminateUser(userId);
          break;
        case "rank_change":
          if (!targetRole || isNaN(targetRole)) {
            return res.status(400).json({
              success: false,
              error: "Target role ID is required for rank change.",
            });
          }
          try {
            const adminUserRank = await prisma.rank.findFirst({
              where: {
                userId: BigInt(req.session.userid),
                workspaceGroupId: workspaceGroupId,
              },
            });

            if (adminUserRank) {
              const storedAdminRankId = Number(adminUserRank.rankId);
              const roles = await noblox.getRoles(workspaceGroupId);
              const targetRoleData = roles.find(r => r.id === parseInt(targetRole));
              if (!targetRoleData) {
                return res.status(400).json({
                  success: false,
                  error: "Invalid role ID provided.",
                });
              }
              const targetRankNumber = targetRoleData.rank;
              let adminRankNumber = storedAdminRankId;
              if (storedAdminRankId > 255) {
                const adminRoleData = roles.find(r => r.id === storedAdminRankId);
                adminRankNumber = adminRoleData?.rank ?? storedAdminRankId;
              }
              if (targetRankNumber >= adminRankNumber) {
                const adminUser = await prisma.user.findFirst({
                  where: {
                    userid: BigInt(req.session.userid),
                  },
                  include: {
                    workspaceMemberships: {
                      where: {
                        workspaceGroupId: workspaceGroupId,
                      },
                    },
                  },
                });

                const adminMembership = adminUser?.workspaceMemberships[0];
                const isAdmin = adminMembership?.isAdmin || false;
                if (!isAdmin) {
                  return res.status(403).json({
                    success: false,
                    error:
                      "You cannot set users to a rank equal to or higher than your own.",
                  });
                }
              }
            }
          } catch (rankCheckError) {
            console.error(
              "Error checking admin rank for rank_change:",
              rankCheckError
            );
          }

          result = await rankingProvider.setUserRank(
            userId,
            parseInt(targetRole)
          );
          break;
      }

      if (result && !result.success) {
        console.error("Ranking provider returned an error:", result);
        let errorMessage = result.error || "Ranking operation failed.";
        if (typeof errorMessage === "object") {
          try {
            errorMessage = JSON.stringify(errorMessage);
          } catch (e) {
            errorMessage = String(errorMessage);
          }
        }
        return res.status(400).json({
          success: false,
          error: String(errorMessage),
        });
      }

      if (type === "termination" && result?.success) {
        try {
          if (BigInt(userId) === req.session.userid) {
            return res.status(400).json({
              success: false,
              error: "You cannot terminate yourself.",
            });
          }

          const currentUser = await prisma.user.findFirst({
            where: {
              userid: BigInt(userId),
            },
            include: {
              roles: {
                where: {
                  workspaceGroupId: workspaceGroupId,
                },
              },
            },
          });

          if (currentUser && currentUser.roles.length > 0) {
            for (const role of currentUser.roles) {
              await prisma.user.update({
                where: {
                  userid: BigInt(userId),
                },
                data: {
                  roles: {
                    disconnect: {
                      id: role.id,
                    },
                  },
                },
              });
            }
          }
        } catch (terminationError) {
          console.error("Error removing user roles:", terminationError);
        }
      }

      try {
        let newRank: number;
        let newRankName: string | null = null;
        let newRolesetId: number | null = null;

        if (rankingProvider.type === "roblox_cloud") {
          const { RobloxCloudRankingAPI } = await import("@/utils/openCloud");
          const { getWorkspaceRobloxApiKey } = await import("@/utils/openCloud");
          const apiKey = await getWorkspaceRobloxApiKey(workspaceGroupId);
          if (apiKey) {
            const cloudApi = new RobloxCloudRankingAPI(apiKey, workspaceGroupId);
            const membership = await cloudApi.getUserMembership(userId);
            if (membership) {
              newRank = membership.rank;
              const roles = await cloudApi.getGroupRoles();
              const roleInfo = roles.find(r => r.rank === membership.rank);
              newRankName = roleInfo?.name || null;
              newRolesetId = roleInfo?.id || null;
            } else {
              newRank = 0;
            }
          } else {
            newRank = await noblox.getRankInGroup(workspaceGroupId, userId);
            const newRankInfo = await noblox.getRole(workspaceGroupId, newRank);
            newRankName = newRankInfo?.name || null;
            newRolesetId = newRankInfo?.id || null;
          }
        } else {
          newRank = await noblox.getRankInGroup(workspaceGroupId, userId);
          const newRankInfo = await noblox.getRole(workspaceGroupId, newRank);
          newRankName = newRankInfo?.name || null;
          newRolesetId = newRankInfo?.id || null;
        }

        rankAfter = newRank;
        rankNameAfter = newRankName;
        let rolesetIdForSync = newRolesetId;
        if (!rolesetIdForSync) {
          try {
            const fallbackInfo = await noblox.getRole(workspaceGroupId, newRank);
            rolesetIdForSync = fallbackInfo?.id || null;
          } catch {}
        }
        const rankIdToStore = rolesetIdForSync || newRank;
        await prisma.rank.upsert({
          where: {
            userId_workspaceGroupId: {
              userId: BigInt(userId),
              workspaceGroupId: workspaceGroupId,
            },
          },
          update: {
            rankId: BigInt(rankIdToStore),
          },
          create: {
            userId: BigInt(userId),
            workspaceGroupId: workspaceGroupId,
            rankId: BigInt(rankIdToStore),
          },
        });

        // Sync Firefli workspace role based on the new Roblox group role
        if (rolesetIdForSync) {
          const role = await prisma.role.findFirst({
            where: {
              workspaceGroupId: workspaceGroupId,
              groupRoles: {
                hasSome: [rolesetIdForSync],
              },
            },
          });

          if (role) {
            const currentUser = await prisma.user.findFirst({
              where: {
                userid: BigInt(userId),
              },
              include: {
                roles: {
                  where: {
                    workspaceGroupId: workspaceGroupId,
                  },
                },
              },
            });

            if (currentUser && currentUser.roles.length > 0) {
              for (const oldRole of currentUser.roles) {
                await prisma.user.update({
                  where: {
                    userid: BigInt(userId),
                  },
                  data: {
                    roles: {
                      disconnect: {
                        id: oldRole.id,
                      },
                    },
                  },
                });
              }
            }

            await prisma.user.update({
              where: {
                userid: BigInt(userId),
              },
              data: {
                roles: {
                  connect: {
                    id: role.id,
                  },
                },
              },
            });
          }
        }
      } catch (rankUpdateError) {
        console.error("Error updating user rank in database:", rankUpdateError);
      }
    } catch (error: any) {
      let errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Ranking operation failed";
      if (typeof errorMessage === "object") {
        try {
          errorMessage = JSON.stringify(errorMessage);
        } catch (e) {
          errorMessage = String(errorMessage);
        }
      }
      return res.status(500).json({
        success: false,
        error: String(errorMessage),
      });
    }
  }

  const userbook = await prisma.userBook.create({
    data: {
      userId: BigInt(uid as string),
      type,
      workspaceGroupId: parseInt(id as string),
      reason: notes,
      adminId: BigInt(req.session.userid),
      rankBefore,
      rankAfter,
      rankNameBefore,
      rankNameAfter,
    },
    include: {
      admin: true,
    },
  });

  try {
    await logAudit(
      parseInt(id as string),
      req.session.userid || null,
      "userbook.create",
      `userbook:${userbook.id}`,
      {
        type,
        userId: uid,
        adminId: req.session.userid,
        reason: notes,
        rankBefore,
        rankAfter,
        rankNameBefore,
        rankNameAfter,
      }
    );
  } catch (e) {}

  // Send Bloxlink DM notification if requested and Bloxlink is configured
  if (notifyDiscord && (type === 'promotion' || type === 'demotion' || type === 'warning' || type === 'termination' || type === 'resignation')) {
    const bloxlinkIntegration = await prisma.bloxlinkIntegration.findUnique({
      where: { workspaceGroupId: parseInt(id as string) },
    }).catch(() => null);

    if (bloxlinkIntegration?.isActive) {
      const notificationData: any = {
        reason: notes,
        issuedBy: String(req.session.userid),
        newRole: rankNameAfter || undefined,
        rankBefore,
        rankAfter,
        rankNameBefore,
        rankNameAfter,
      };
      
      if (type === 'termination') {
        notificationData.terminationAction = terminationAction || 'none';
        notificationData.banDeleteDays = banDeleteDays || 0;
      }
      
      sendBloxlinkNotification(parseInt(id as string), userId, type as any, notificationData).catch((e) => console.error('[Bloxlink] Failed to send notification:', e));
    }
  }

  res.status(200).json({
    success: true,
    log: JSON.parse(
      JSON.stringify(userbook, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    ),
    ...(type === 'termination' || type === 'resignation' ? { terminated: true } : {}),
  });
}

export default withSessionRoute(handler);
