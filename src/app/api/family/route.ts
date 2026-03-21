import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/client";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET: Get user's family groups
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const familyMembers = await prisma.familyMember.findMany({
      where: { user_id: userId },
      include: {
        family: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, email: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    const families = familyMembers.map((fm) => ({
      id: fm.family.id,
      name: fm.family.name,
      invite_code: fm.family.invite_code,
      role: fm.role,
      created_by: fm.family.created_by,
      members: fm.family.members.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joined_at: m.joined_at,
      })),
    }));

    return NextResponse.json({ families });
  } catch (err) {
    console.error("GET /api/family error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: Create or Join a family group
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name } = body;
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json({ error: "Family name must be at least 2 characters" }, { status: 400 });
      }

      // Generate unique invite code
      let inviteCode = generateInviteCode();
      let exists = await prisma.family.findUnique({ where: { invite_code: inviteCode } });
      while (exists) {
        inviteCode = generateInviteCode();
        exists = await prisma.family.findUnique({ where: { invite_code: inviteCode } });
      }

      const family = await prisma.family.create({
        data: {
          name: name.trim(),
          invite_code: inviteCode,
          created_by: userId,
          members: {
            create: {
              user_id: userId,
              role: "admin",
            },
          },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
        },
      });

      return NextResponse.json({
        family: {
          id: family.id,
          name: family.name,
          invite_code: family.invite_code,
          role: "admin",
          created_by: family.created_by,
          members: family.members.map((m) => ({
            id: m.id,
            user_id: m.user_id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            joined_at: m.joined_at,
          })),
        },
      });
    }

    if (action === "join") {
      const { invite_code } = body;
      if (!invite_code || typeof invite_code !== "string") {
        return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
      }

      const family = await prisma.family.findUnique({
        where: { invite_code: invite_code.toUpperCase().trim() },
        include: { members: true },
      });

      if (!family) {
        return NextResponse.json({ error: "Invalid invite code. Please check and try again." }, { status: 404 });
      }

      // Check if already a member
      const alreadyMember = family.members.some((m) => m.user_id === userId);
      if (alreadyMember) {
        return NextResponse.json({ error: "You are already a member of this family" }, { status: 400 });
      }

      await prisma.familyMember.create({
        data: {
          family_id: family.id,
          user_id: userId,
          role: "member",
        },
      });

      // Return updated family
      const updatedFamily = await prisma.family.findUnique({
        where: { id: family.id },
        include: {
          members: {
            include: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
        },
      });

      return NextResponse.json({
        family: {
          id: updatedFamily!.id,
          name: updatedFamily!.name,
          invite_code: updatedFamily!.invite_code,
          role: "member",
          created_by: updatedFamily!.created_by,
          members: updatedFamily!.members.map((m) => ({
            id: m.id,
            user_id: m.user_id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            joined_at: m.joined_at,
          })),
        },
      });
    }

    if (action === "leave") {
      const { family_id } = body;
      if (!family_id) {
        return NextResponse.json({ error: "Family ID is required" }, { status: 400 });
      }

      const family = await prisma.family.findUnique({
        where: { id: family_id },
        include: { members: true },
      });

      if (!family) {
        return NextResponse.json({ error: "Family not found" }, { status: 404 });
      }

      // Admin can't leave if they're the only admin
      const member = family.members.find((m) => m.user_id === userId);
      if (!member) {
        return NextResponse.json({ error: "Not a member" }, { status: 400 });
      }

      if (member.role === "admin") {
        const otherAdmins = family.members.filter(
          (m) => m.role === "admin" && m.user_id !== userId
        );
        if (otherAdmins.length === 0 && family.members.length > 1) {
          return NextResponse.json(
            { error: "Transfer admin role to another member before leaving" },
            { status: 400 }
          );
        }
      }

      await prisma.familyMember.delete({
        where: { id: member.id },
      });

      // If last member, delete the family
      if (family.members.length <= 1) {
        await prisma.family.delete({ where: { id: family_id } });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/family error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
