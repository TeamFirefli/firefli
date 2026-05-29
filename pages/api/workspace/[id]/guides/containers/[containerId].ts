import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { logAudit } from "@/utils/logs";

type Data = {
  success: boolean;
  error?: string;
  container?: any;
};

export default withPermissionCheck(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const workspaceId = parseInt(req.query.id as string);
  const containerId = req.query.containerId as string;

  if (!workspaceId || !containerId) {
    return res.status(400).json({ success: false, error: "Missing required parameters" });
  }

  const existing = await prisma.documentContainer.findFirst({
    where: { id: containerId, workspaceGroupId: workspaceId },
  });

  if (!existing) return res.status(404).json({ success: false, error: "Container not found" });

  const user = await prisma.user.findFirst({
    where: { userid: req.session.userid },
    include: {
      roles: { where: { workspaceGroupId: workspaceId } },
      workspaceMemberships: { where: { workspaceGroupId: workspaceId } },
    },
  });

  if (!user) return res.status(403).json({ success: false, error: "Forbidden" });

  const membership = user.workspaceMemberships?.[0];
  const isAdmin = membership?.isAdmin || false;
  const canEdit = isAdmin || (user.roles || []).some((r: any) =>
    (r.permissions || []).includes("edit_docs")
  );
  const canDelete = isAdmin || (user.roles || []).some((r: any) =>
    (r.permissions || []).includes("delete_docs")
  );

  // GET - fetch a single container
  if (req.method === "GET") {
    const container = await prisma.documentContainer.findFirst({
      where: { id: containerId, workspaceGroupId: workspaceId },
      include: {
        owner: { select: { userid: true, username: true, picture: true } },
        roles: { select: { id: true, name: true } },
        departments: { select: { id: true, name: true } },
        documents: {
          where: { requiresAcknowledgment: false },
          include: {
            owner: { select: { userid: true, username: true, picture: true } },
          },
        },
      },
    });
    return res.status(200).json({
      success: true,
      container: JSON.parse(
        JSON.stringify(container, (_, v) => (typeof v === "bigint" ? v.toString() : v))
      ),
    });
  }

  // PUT - update name/description/roles/departments/documents
  if (req.method === "PUT") {
    if (!canEdit) return res.status(403).json({ success: false, error: "Insufficient permissions" });

    const { name, description, roles, departments, documents } = req.body;

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ success: false, error: "Container name cannot be empty" });
    }

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    if (Array.isArray(roles)) {
      const validRoles = await prisma.role.findMany({
        where: { id: { in: roles }, workspaceGroupId: workspaceId },
        select: { id: true },
      });
      updateData.roles = { set: validRoles.map((r) => ({ id: r.id })) };
    }
    if (Array.isArray(departments)) {
      const validDepts = await prisma.department.findMany({
        where: { id: { in: departments }, workspaceGroupId: workspaceId },
        select: { id: true },
      });
      updateData.departments = { set: validDepts.map((d) => ({ id: d.id })) };
    }
    if (Array.isArray(documents)) {
      const validDocs = await prisma.document.findMany({
        where: { id: { in: documents }, workspaceGroupId: BigInt(workspaceId) },
        select: { id: true },
      });
      updateData.documents = { set: validDocs.map((d) => ({ id: d.id })) };
    }

    if (req.body.toggleDocument && typeof req.body.toggleDocument === "object") {
      const { id: docId, action } = req.body.toggleDocument;
      if (typeof docId !== "string" || !docId || !["add", "remove"].includes(action)) {
        return res.status(400).json({ success: false, error: "Invalid toggleDocument payload" });
      }

      const docExists = await prisma.document.findFirst({
        where: { id: docId, workspaceGroupId: BigInt(workspaceId) },
        select: { id: true },
      });
      if (!docExists) {
        return res.status(404).json({ success: false, error: "Document not found in this workspace" });
      }

      if (action === "remove") {
        const isConnected = await prisma.documentContainer.findFirst({
          where: { id: containerId, documents: { some: { id: docExists.id } } },
          select: { id: true },
        });
        if (!isConnected) {
          const currentContainer = await prisma.documentContainer.findFirst({
            where: { id: containerId },
            include: {
              owner: { select: { userid: true, username: true, picture: true } },
              roles: { select: { id: true, name: true } },
              departments: { select: { id: true, name: true } },
              documents: { select: { id: true } },
            },
          });
          return res.status(200).json({
            success: true,
            container: JSON.parse(
              JSON.stringify(currentContainer, (_, v) => (typeof v === "bigint" ? v.toString() : v))
            ),
          });
        }
        updateData.documents = { disconnect: { id: docExists.id } };
      } else {
        updateData.documents = { connect: { id: docExists.id } };
      }
    }

    let container: any;
    try {
      container = await prisma.documentContainer.update({
        where: { id: containerId },
        data: updateData,
        include: {
          owner: { select: { userid: true, username: true, picture: true } },
          roles: { select: { id: true, name: true } },
          departments: { select: { id: true, name: true } },
          documents: { select: { id: true } },
        },
      });
    } catch (e: any) {
      console.error("[container update error]", e?.code, e?.message);
      if (e.code === "P2003" || e.code === "P2025") {
        return res.status(400).json({ success: false, error: "One or more IDs are invalid or no longer exist." });
      }
      return res.status(500).json({ success: false, error: "Failed to update container." });
    }

    try {
      const isMetadataChange =
        name !== undefined ||
        description !== undefined ||
        Array.isArray(roles) ||
        Array.isArray(departments);
      if (isMetadataChange) {
        await logAudit(workspaceId, Number(req.session.userid), "container.update", `container:${containerId}`, { id: containerId, name: container.name });
      }
    } catch {}

    return res.status(200).json({
      success: true,
      container: JSON.parse(
        JSON.stringify(container, (_, v) => (typeof v === "bigint" ? v.toString() : v))
      ),
    });
  }

  if (req.method === "DELETE") {
    if (!canDelete) return res.status(403).json({ success: false, error: "Insufficient permissions" });

    await prisma.documentContainer.delete({ where: { id: containerId } });

    try {
      await logAudit(workspaceId, Number(req.session.userid), "container.delete", `container:${containerId}`, { id: containerId, name: existing.name });
    } catch {}

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
