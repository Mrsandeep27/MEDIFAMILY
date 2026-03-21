"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyPage() {
  const router = useRouter();

  useEffect(() => {
    // OTP verification no longer needed with email/password auth
    router.replace("/login");
  }, [router]);

  return null;
}
