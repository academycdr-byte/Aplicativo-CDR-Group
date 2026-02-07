import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        // Forcefully add the missing videoUrl column if migration didn't run
        // Using raw SQL to bypass Prisma migration constraints
        await prisma.$executeRawUnsafe(`ALTER TABLE "ad_metrics" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;`);
        return NextResponse.json({ success: true, message: "Column videoUrl added successfully" });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
