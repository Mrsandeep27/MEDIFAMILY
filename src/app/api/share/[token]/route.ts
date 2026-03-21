import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!/^[A-Za-z0-9\-_]{8,128}$/.test(token)) {
    return NextResponse.json({ error: "Invalid share link" }, { status: 400 });
  }

  try {
    // Find active, non-expired share link
    const shareLink = await prisma.shareLink.findFirst({
      where: {
        token,
        is_active: true,
        is_deleted: false,
        expires_at: { gt: new Date() },
      },
    });

    if (!shareLink) {
      return NextResponse.json(
        { error: "Share link not found or expired" },
        { status: 404 }
      );
    }

    // Get member
    const member = await prisma.member.findUnique({
      where: { id: shareLink.member_id },
      select: {
        name: true,
        blood_group: true,
        allergies: true,
        chronic_conditions: true,
        date_of_birth: true,
        gender: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get records
    const recordWhere: any = {
      member_id: shareLink.member_id,
      is_deleted: false,
    };
    if (shareLink.record_ids.length > 0) {
      recordWhere.id = { in: shareLink.record_ids };
    }

    const records = await prisma.healthRecord.findMany({
      where: recordWhere,
      select: {
        id: true,
        type: true,
        title: true,
        doctor_name: true,
        hospital_name: true,
        visit_date: true,
        diagnosis: true,
        notes: true,
      },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    // Get medicines
    const medicines = await prisma.medicine.findMany({
      where: { member_id: shareLink.member_id, is_deleted: false },
      select: {
        name: true,
        dosage: true,
        frequency: true,
        is_active: true,
      },
    });

    // Log access (anonymized)
    await prisma.shareAccessLog.create({
      data: { share_link_id: shareLink.id },
    }).catch(() => {});

    return NextResponse.json({
      member: {
        ...member,
        allergies: member.allergies || [],
        chronic_conditions: member.chronic_conditions || [],
      },
      records,
      medicines,
    });
  } catch (err) {
    console.error("Share API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
