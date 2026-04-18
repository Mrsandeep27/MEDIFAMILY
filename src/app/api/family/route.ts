import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// Verify user from Supabase auth — NEVER trust client-provided headers for identity.
// Uses the shared 30s auth cache in @/lib/supabase/auth-cache.
async function getUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const authUser = await getUserFromRequest(request);
  if (!authUser) return null;
  return { id: authUser.userId, email: authUser.email };
}

// Ensure a row exists in public.users for this auth user.
// Supabase Auth uses auth.users (separate schema). Our family_members table
// has a FK to public.users, so we must create the row lazily before any insert.
async function ensureUserRow(userId: string, email: string): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) return;

  await supabaseAdmin.from("users").insert({
    id: userId,
    email,
    password_hash: "supabase-auth", // placeholder — auth handled by Supabase Auth
    name: email.split("@")[0],
  });
}

// GET: Get user's family groups
export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = auth.id;

    const { data: familyMembers } = await supabaseAdmin
      .from("family_members")
      .select("role, family_id, families(id, name, invite_code, created_by, family_members(id, user_id, role, joined_at, users(id, email, name)))")
      .eq("user_id", userId);

    const families = (familyMembers || []).map((fm: Record<string, unknown>) => {
      const family = fm.families as Record<string, unknown>;
      const members = (family?.family_members as Array<Record<string, unknown>>) || [];
      return {
        id: family?.id,
        name: family?.name,
        invite_code: family?.invite_code,
        role: fm.role,
        created_by: family?.created_by,
        members: members.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          name: (m.users as Record<string, string>)?.name,
          email: (m.users as Record<string, string>)?.email,
          role: m.role,
          joined_at: m.joined_at,
        })),
      };
    });

    return NextResponse.json({ families });
  } catch (err) {
    console.error("GET /api/family error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: Create or Join a family group
export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = auth.id;

    // Make sure public.users has a row for this user (FK requirement)
    await ensureUserRow(userId, auth.email);

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name } = body;
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json({ error: "Family name must be at least 2 characters" }, { status: 400 });
      }

      // Generate unique invite code (use maybeSingle to avoid PGRST116 errors)
      let inviteCode = generateInviteCode();
      let { data: existing } = await supabaseAdmin
        .from("families")
        .select("id")
        .eq("invite_code", inviteCode)
        .maybeSingle();
      while (existing) {
        inviteCode = generateInviteCode();
        ({ data: existing } = await supabaseAdmin
          .from("families")
          .select("id")
          .eq("invite_code", inviteCode)
          .maybeSingle());
      }

      // Create family
      const { data: family, error: famErr } = await supabaseAdmin
        .from("families")
        .insert({ name: name.trim(), invite_code: inviteCode, created_by: userId })
        .select()
        .single();

      if (famErr || !family) {
        // Surface the actual error so we can debug
        console.error("[family/create] families.insert failed:", famErr);
        return NextResponse.json(
          { error: famErr?.message || "Failed to create family" },
          { status: 500 }
        );
      }

      // Add creator as admin
      const { error: memErr } = await supabaseAdmin
        .from("family_members")
        .insert({
          family_id: family.id,
          user_id: userId,
          role: "admin",
        });

      if (memErr) {
        // Roll back the family insert
        console.error("[family/create] family_members.insert failed:", memErr);
        await supabaseAdmin.from("families").delete().eq("id", family.id);
        return NextResponse.json(
          { error: `Failed to add you as admin: ${memErr.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        family: {
          id: family.id,
          name: family.name,
          invite_code: family.invite_code,
          role: "admin",
          created_by: family.created_by,
          members: [],
        },
      });
    }

    if (action === "join") {
      const { invite_code } = body;
      if (!invite_code || typeof invite_code !== "string") {
        return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
      }

      const { data: family } = await supabaseAdmin
        .from("families")
        .select("id, name, invite_code, created_by")
        .eq("invite_code", invite_code.toUpperCase().trim())
        .maybeSingle();

      if (!family) {
        return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
      }

      // Check if already a member
      const { data: existing } = await supabaseAdmin
        .from("family_members")
        .select("id")
        .eq("family_id", family.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: "You are already a member of this family" }, { status: 400 });
      }

      const { error: memErr } = await supabaseAdmin
        .from("family_members")
        .insert({
          family_id: family.id,
          user_id: userId,
          role: "member",
        });

      if (memErr) {
        console.error("[family/join] family_members.insert failed:", memErr);
        return NextResponse.json(
          { error: `Failed to join: ${memErr.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        family: { ...family, role: "member", members: [] },
      });
    }

    if (action === "leave") {
      const { family_id } = body;
      if (!family_id) {
        return NextResponse.json({ error: "Family ID is required" }, { status: 400 });
      }

      const { data: members } = await supabaseAdmin
        .from("family_members")
        .select("id, user_id, role")
        .eq("family_id", family_id);

      if (!members) {
        return NextResponse.json({ error: "Family not found" }, { status: 404 });
      }

      const member = members.find((m: { user_id: string }) => m.user_id === userId);
      if (!member) {
        return NextResponse.json({ error: "Not a member" }, { status: 400 });
      }

      if (member.role === "admin") {
        const otherAdmins = members.filter(
          (m: { role: string; user_id: string }) => m.role === "admin" && m.user_id !== userId
        );
        if (otherAdmins.length === 0 && members.length > 1) {
          return NextResponse.json(
            { error: "Transfer admin role to another member before leaving" },
            { status: 400 }
          );
        }
      }

      await supabaseAdmin.from("family_members").delete().eq("id", member.id);

      // If last member, delete the family
      if (members.length <= 1) {
        await supabaseAdmin.from("families").delete().eq("id", family_id);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/family error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
