
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
    try {
        const email = "academy.cdr@gmail.com";
        const password = "lacerda12";
        const name = "Admin CDR";

        console.log(`Checking for user: ${email}...`);

        const hashedPassword = await bcrypt.hash(password, 10);

        let user = await prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            console.log("User found. Updating password...");
            user = await prisma.user.update({
                where: { id: user.id },
                data: { hashedPassword },
            });
        } else {
            console.log("User not found. Creating new user...");
            user = await prisma.user.create({
                data: {
                    email,
                    name,
                    hashedPassword,
                },
            });
        }

        // Check organization and membership
        console.log("Checking organization membership...");

        // Find valid membership
        let membership = await prisma.membership.findFirst({
            where: { userId: user.id },
            include: { organization: true },
        });

        if (membership) {
            console.log(`User is already member of organization: ${membership.organization.name}`);
            if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
                console.log(`Updating role from ${membership.role} to OWNER...`);
                await prisma.membership.update({
                    where: { id: membership.id },
                    data: { role: "OWNER" }
                });
            }
        } else {
            console.log("User has no organization. Creating default organization...");
            const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
            const organization = await prisma.organization.create({
                data: {
                    name: `${name}'s Organization`,
                    slug: `${slug}-${user.id.slice(0, 6)}`,
                },
            });

            console.log("Assigning OWNER role...");
            await prisma.membership.create({
                data: {
                    userId: user.id,
                    organizationId: organization.id,
                    role: "OWNER",
                },
            });
        }

        return NextResponse.json({ success: true, message: "Admin user created/updated successfully." });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
