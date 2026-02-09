import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

/**
 * Get session with organization context.
 * Wrapped with React cache() to deduplicate calls within a single server request.
 * When called multiple times from Promise.allSettled in a consolidated action,
 * only the first call actually executes; subsequent calls return the cached result.
 */
export const getSessionWithOrg = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const membership = await prisma.membership.findFirst({
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
});
