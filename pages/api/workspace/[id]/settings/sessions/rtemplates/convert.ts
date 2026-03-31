import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

type Data = {
  success: boolean;
  error?: string;
  created?: number;
  importable?: number;
  templates?: any[];
  patched?: number;
  patchable?: number;
};

export default withPermissionCheck(handler, "manage_features");

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const workspaceGroupId = parseInt(req.query.id as string);
  if (req.query.action === "patch-host-roles" || (req.method === "POST" && req.body?.action === "patch-host-roles")) {
    const templates = await prisma.sessionRoleTemplate.findMany({
      where: { workspaceGroupId, archived: false },
      select: { name: true, hostRole: true },
    });
    const templateByName = new Map<string, string | null>();
    for (const t of templates) {
      templateByName.set(t.name.trim().toLowerCase(), t.hostRole);
    }

    const activeSessionTypeIds = await prisma.session.findMany({
      where: {
        sessionType: { workspaceGroupId },
        users: { some: { archived: { not: true } } },
      },
      select: { sessionTypeId: true },
      distinct: ["sessionTypeId"],
    });
    const ids = activeSessionTypeIds.map((s) => s.sessionTypeId);

    if (ids.length === 0) {
      if (req.method === "GET") return res.status(200).json({ success: true, patchable: 0 });
      return res.status(200).json({ success: true, patched: 0 });
    }

    const sessionTypes = await prisma.sessionType.findMany({
      where: { id: { in: ids } },
      select: { id: true, slots: true },
    });

    let patchable = 0;
    for (const st of sessionTypes) {
      const slots = (st.slots as any[]) || [];
      for (const slot of slots) {
        if (slot?.hostRole !== undefined && slot.hostRole !== null) continue;
        const name = typeof slot?.name === "string" ? slot.name.trim().toLowerCase() : "";
        if (templateByName.has(name) && templateByName.get(name) !== undefined) {
          patchable++;
        }
      }
    }

    if (req.method === "GET") {
      return res.status(200).json({ success: true, patchable });
    }

    // Apply patches
    let patched = 0;
    for (const st of sessionTypes) {
      const slots = (st.slots as any[]) || [];
      let changed = false;
      const updatedSlots = slots.map((slot: any) => {
        if (!slot || (slot.hostRole !== undefined && slot.hostRole !== null)) return slot;
        const name = typeof slot.name === "string" ? slot.name.trim().toLowerCase() : "";
        if (!templateByName.has(name)) return slot;
        changed = true;
        patched++;
        return { ...slot, hostRole: templateByName.get(name) ?? null };
      });
      if (changed) {
        await prisma.sessionType.update({
          where: { id: st.id },
          data: { slots: updatedSlots },
        });
      }
    }

    return res.status(200).json({ success: true, patched });
  }

  const sessionTypes = await prisma.sessionType.findMany({
    where: { workspaceGroupId },
    select: { slots: true },
  });

  const legacySlotNames = new Set<string>();
  for (const st of sessionTypes) {
    if (!Array.isArray(st.slots)) continue;
    for (const rawSlot of st.slots as any[]) {
      const slot = typeof rawSlot === "object" && rawSlot !== null ? rawSlot : null;
      if (!slot) continue;
      // Skip already-migrated entries
      if (slot.templateId) continue;
      const name = typeof slot.name === "string" ? slot.name.trim() : null;
      if (name) legacySlotNames.add(name);
    }
  }

  if (legacySlotNames.size === 0) {
    return res.status(200).json({ success: true, created: 0, importable: 0, templates: [] });
  }

  const existing = await prisma.sessionRoleTemplate.findMany({
    where: { workspaceGroupId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));

  const toCreate = [...legacySlotNames].filter(
    (name) => !existingNames.has(name.toLowerCase())
  );

  if (req.method === "GET") {
    return res.status(200).json({ success: true, importable: toCreate.length });
  }

  if (toCreate.length === 0) {
    return res.status(200).json({ success: true, created: 0, importable: 0, templates: [] });
  }

  const created = await prisma.$transaction(
    toCreate.map((name) =>
      prisma.sessionRoleTemplate.create({
        data: { name, slots: 1, hostRole: null, groupRoles: [], workspaceGroupId },
        include: { category: true },
      })
    )
  );

  return res.status(200).json({ success: true, created: created.length, importable: 0, templates: created });
}
