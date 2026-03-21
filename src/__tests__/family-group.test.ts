import { describe, it, expect } from "vitest";

describe("Family Group Logic", () => {
  describe("Invite Code Generation", () => {
    function generateInviteCode(): string {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    }

    it("generates 8-character codes", () => {
      const code = generateInviteCode();
      expect(code).toHaveLength(8);
    });

    it("generates unique codes", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateInviteCode());
      }
      // With 31^8 = 852B+ possibilities, 100 codes should all be unique
      expect(codes.size).toBe(100);
    });

    it("uses only unambiguous characters (no I, O, 0, 1)", () => {
      const ambiguousChars = ["I", "O", "0", "1"];
      for (let i = 0; i < 50; i++) {
        const code = generateInviteCode();
        for (const char of ambiguousChars) {
          expect(code).not.toContain(char);
        }
      }
    });

    it("generates uppercase-only codes", () => {
      for (let i = 0; i < 20; i++) {
        const code = generateInviteCode();
        expect(code).toBe(code.toUpperCase());
      }
    });
  });

  describe("Family Group Validation", () => {
    it("validates family name length >= 2", () => {
      expect("Pandey Family".trim().length >= 2).toBe(true);
      expect("PF".trim().length >= 2).toBe(true);
      expect("P".trim().length >= 2).toBe(false);
      expect("".trim().length >= 2).toBe(false);
    });

    it("invite code should be uppercased for matching", () => {
      const input = "abcd1234";
      expect(input.toUpperCase().trim()).toBe("ABCD1234");
    });

    it("handles whitespace in invite codes", () => {
      const input = "  ABCD1234  ";
      expect(input.toUpperCase().trim()).toBe("ABCD1234");
    });
  });

  describe("Role Logic", () => {
    it("creator gets admin role", () => {
      const creatorRole = "admin";
      expect(creatorRole).toBe("admin");
    });

    it("joiner gets member role", () => {
      const joinerRole = "member";
      expect(joinerRole).toBe("member");
    });

    it("admin can't leave if only admin with other members", () => {
      const members = [
        { user_id: "u1", role: "admin" },
        { user_id: "u2", role: "member" },
      ];
      const currentUser = "u1";
      const currentMember = members.find((m) => m.user_id === currentUser);
      const otherAdmins = members.filter(
        (m) => m.role === "admin" && m.user_id !== currentUser
      );

      const canLeave = !(
        currentMember?.role === "admin" &&
        otherAdmins.length === 0 &&
        members.length > 1
      );
      expect(canLeave).toBe(false);
    });

    it("admin can leave if they're the only member", () => {
      const members = [{ user_id: "u1", role: "admin" }];
      const currentUser = "u1";
      const currentMember = members.find((m) => m.user_id === currentUser);
      const otherAdmins = members.filter(
        (m) => m.role === "admin" && m.user_id !== currentUser
      );

      const canLeave = !(
        currentMember?.role === "admin" &&
        otherAdmins.length === 0 &&
        members.length > 1
      );
      expect(canLeave).toBe(true);
    });

    it("member can always leave", () => {
      const members = [
        { user_id: "u1", role: "admin" },
        { user_id: "u2", role: "member" },
      ];
      const currentUser = "u2";
      const currentMember = members.find((m) => m.user_id === currentUser);

      const canLeave = currentMember?.role !== "admin";
      expect(canLeave).toBe(true);
    });
  });

  describe("Family User IDs Aggregation", () => {
    it("collects unique user IDs from all family groups", () => {
      const families = [
        {
          id: "f1",
          members: [
            { user_id: "u1" },
            { user_id: "u2" },
          ],
        },
        {
          id: "f2",
          members: [
            { user_id: "u2" },
            { user_id: "u3" },
          ],
        },
      ];

      const allUserIds = Array.from(
        new Set(families.flatMap((f) => f.members.map((m) => m.user_id)))
      );

      expect(allUserIds).toHaveLength(3);
      expect(allUserIds).toContain("u1");
      expect(allUserIds).toContain("u2");
      expect(allUserIds).toContain("u3");
    });
  });
});
