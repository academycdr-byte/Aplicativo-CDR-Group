import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

export async function getSessionWithOrg() {
  const session = await getSession();
  if (!session) return null;

  // Usar o organizationId do JWT se disponível, caso contrário buscar o primeiro
  const orgId = session.user.organizationId;

  const membership = orgId
    ? await prisma.membership.findFirst({
        where: { userId: session.user.id, organizationId: orgId },
        include: { organization: true },
      })
    : await prisma.membership.findFirst({
        where: { userId: session.user.id },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      });

  if (!membership) return null;

  return {
    user: session.user,
    organization: membership.organization,
    role: membership.role,
    membershipId: membership.id,
  };
}
