import prisma from './database';

export type NotificationType =
  | 'notice_approved'
  | 'notice_denied'
  | 'notice_submitted'
  | 'userbook_warning'
  | 'userbook_promotion'
  | 'userbook_demotion'
  | 'userbook_termination'
  | 'userbook_resignation'
  | 'session_started'
  | 'recommendation_created';

export async function createNotification(
  userId: bigint | number,
  workspaceGroupId: bigint | number,
  type: NotificationType,
  title: string,
  body: string,
  href?: string
) {
  const userIdBig = BigInt(userId);
  const wsBig = BigInt(workspaceGroupId);

  await prisma.notification.create({
    data: {
      userId: userIdBig,
      workspaceGroupId: wsBig,
      type,
      title,
      body,
      href: href ?? null,
    },
  });

}
