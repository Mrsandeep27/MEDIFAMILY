import { create } from "zustand";

interface FamilyState {
  selectedMemberId: string | null;
  setSelectedMember: (id: string | null) => void;
}

export const useFamilyStore = create<FamilyState>()((set) => ({
  selectedMemberId: null,
  setSelectedMember: (id) => set({ selectedMemberId: id }),
}));
