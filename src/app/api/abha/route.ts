import { NextRequest, NextResponse } from "next/server";
import {
  generateAadhaarOtp,
  verifyAadhaarOtp,
  generateMobileOtp,
  verifyMobileOtpAndCreate,
  createHealthId,
  searchByHealthId,
  loginWithMobile,
  loginWithAadhaar,
  confirmAuth,
  getAbhaProfile,
} from "@/lib/abha/client";
import { abhaActionSchema } from "@/lib/utils/validators";

// POST /api/abha — handles all ABHA operations via "action" field
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if ABDM is configured
    if (!process.env.ABDM_CLIENT_ID || !process.env.ABDM_CLIENT_SECRET) {
      return NextResponse.json(
        {
          error: "ABDM integration not configured yet",
          message: "Sandbox credentials pending. Please check back later.",
          configured: false,
        },
        { status: 503 }
      );
    }

    // Validate all inputs via discriminated union
    const parsed = abhaActionSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const data = parsed.data;

    switch (data.action) {
      // ============================================================
      // M1: ABHA Creation via Aadhaar
      // ============================================================
      case "generate-aadhaar-otp": {
        const result = await generateAadhaarOtp(data.aadhaar);
        return NextResponse.json(result);
      }

      case "verify-aadhaar-otp": {
        const result = await verifyAadhaarOtp(data.txnId, data.otp);
        return NextResponse.json(result);
      }

      case "generate-mobile-otp": {
        const result = await generateMobileOtp(data.txnId, data.mobile);
        return NextResponse.json(result);
      }

      case "verify-mobile-create": {
        const result = await verifyMobileOtpAndCreate(data.txnId, data.otp);
        return NextResponse.json(result);
      }

      case "create-health-id": {
        const result = await createHealthId(data.txnId, data.healthId, data.firstName, data.lastName || "");
        return NextResponse.json(result);
      }

      // ============================================================
      // M1: ABHA Linking (existing ABHA)
      // ============================================================
      case "search-abha": {
        const result = await searchByHealthId(data.healthId);
        return NextResponse.json(result);
      }

      case "login-mobile-otp": {
        const result = await loginWithMobile(data.healthId);
        return NextResponse.json(result);
      }

      case "login-aadhaar-otp": {
        const result = await loginWithAadhaar(data.healthId);
        return NextResponse.json(result);
      }

      case "confirm-auth": {
        const result = await confirmAuth(data.txnId, data.otp);
        return NextResponse.json(result);
      }

      case "get-profile": {
        const result = await getAbhaProfile(data.xToken);
        return NextResponse.json(result);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "ABHA operation failed";
    console.error("[ABHA API Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
