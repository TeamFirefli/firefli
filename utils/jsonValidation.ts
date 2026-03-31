import { z } from "zod/v4";

export const configValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

export const sessionTypeStatusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().min(1).max(50),
  timeAfter: z.number(),
  id: z.string().optional(),
});

export const sessionTypeSlotSchema = z.object({
  name: z.string().min(1).max(100),
  slots: z.number().int().min(0).max(100),
  id: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  categoryWeight: z.number().int().min(0).max(9999).optional(),
  weight: z.number().int().min(0).max(9999).optional(),
  hostRole: z.enum(["primary", "secondary"]).nullable().optional(),
  groupRoles: z.array(z.number().int().min(0)).optional(),
});

const tiptapMarkSchema: z.ZodType<any> = z.object({
  type: z.string().max(50),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

const tiptapNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.string().max(50),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z.array(tiptapMarkSchema).optional(),
    content: z.array(tiptapNodeSchema).optional(),
    text: z.string().optional(),
  })
);

export const tiptapDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(tiptapNodeSchema).optional(),
});

export const quotaProgressSchema = z.record(
  z.string(), // quota ID
  z.object({
    current: z.number(),
    target: z.number(),
    percentage: z.number().min(0).max(100).optional(),
  })
);

export const stickyAnnouncementSectionSchema = z.array(
  z.object({
    title: z.string().max(200).optional(),
    content: z.string().max(5000).optional(),
    type: z.enum(["text", "list", "image"]).optional(),
    items: z.array(z.string().max(500)).optional(),
    imageUrl: z.string().url().optional(),
  })
);

export const loginInputSchema = z.object({
  username: z.string().min(1).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(1).max(128),
});

export const wallPostInputSchema = z.object({
  content: z.string().min(1).max(5000),
  image: z.string().url().max(2048).optional(),
});

export const inactivityNoticeInputSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  reason: z.string().min(1).max(1000),
});

export const documentInputSchema = z.object({
  name: z.string().min(1).max(200),
  content: tiptapDocumentSchema,
  requiresAcknowledgment: z.boolean().optional(),
  acknowledgmentMethod: z.enum(["signature", "word"]).optional(),
  acknowledgmentWord: z.string().max(100).optional(),
  acknowledgmentDeadline: z.string().datetime().optional(),
  isTrainingDocument: z.boolean().optional(),
  assignToEveryone: z.boolean().optional(),
});

export const sessionInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  date: z.string().datetime(),
  duration: z.number().int().min(1).max(480),
  sessionTypeId: z.string().uuid(),
});

export const apiKeyInputSchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
});

export function validateJsonData<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: z.prettifyError(result.error),
  };
}

export function validateConfigValue(value: unknown): boolean {
  return configValueSchema.safeParse(value).success;
}

export function validateDocumentContent(content: unknown): boolean {
  return tiptapDocumentSchema.safeParse(content).success;
}
