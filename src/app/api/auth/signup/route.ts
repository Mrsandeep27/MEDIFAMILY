import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { signToken, setAuthCookie } from "@/lib/auth/jwt";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    // Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Create user (rely on DB unique constraint instead of check-then-create)
    const password_hash = await bcrypt.hash(password, 12);

    try {
      const user = await prisma.user.create({
        data: { email: email.toLowerCase(), password_hash, name },
      });

      const token = signToken({ userId: user.id, email: user.email });
      await setAuthCookie(token);

      return NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (err) {
      // Handle unique constraint violation (email already exists)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("Signup error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
