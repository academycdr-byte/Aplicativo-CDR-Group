import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated", session: null });
  }

  // Fetch user directly from DB
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, image: true },
  });

  // Check admin status directly
  const adminEmails = (process.env.ADMIN_EMAILS || "academy.cdr@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  const isAppAdmin = user?.email
    ? adminEmails.includes(user.email.toLowerCase())
    : false;

  return NextResponse.json({
    session: {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      organizationId: session.user.organizationId,
      isAppAdmin: session.user.isAppAdmin,
    },
    dbUser: {
      email: user?.email,
      name: user?.name,
      hasImage: !!user?.image,
    },
    adminCheck: {
      adminEmails,
      userEmail: user?.email,
      isAppAdmin,
    },
  });
}
