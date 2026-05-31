import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ApiUser, MembershipBrief, Role } from "@/types/api";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: ApiUser | null;
  memberships: MembershipBrief[];
  activeWorkspaceId: string | null;

  setTokens: (access: string, refresh?: string | null) => void;
  setUser: (user: ApiUser, memberships?: MembershipBrief[]) => void;
  setMemberships: (memberships: MembershipBrief[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  logout: () => void;

  activeMembership: () => MembershipBrief | null;
  activeRole: () => Role | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      memberships: [],
      activeWorkspaceId: null,

      setTokens: (access, refresh = null) =>
        set((s) => ({
          accessToken: access,
          refreshToken: refresh ?? s.refreshToken,
        })),
      setUser: (user, memberships) =>
        set((s) => {
          const nextMemberships = memberships ?? s.memberships;
          const stillThere = nextMemberships.find(
            (m) => m.workspace.id === s.activeWorkspaceId,
          );
          return {
            user,
            memberships: nextMemberships,
            activeWorkspaceId: stillThere
              ? s.activeWorkspaceId
              : nextMemberships[0]?.workspace.id ?? null,
          };
        }),
      setMemberships: (memberships) =>
        set((s) => {
          const stillThere = memberships.find(
            (m) => m.workspace.id === s.activeWorkspaceId,
          );
          return {
            memberships,
            activeWorkspaceId: stillThere
              ? s.activeWorkspaceId
              : memberships[0]?.workspace.id ?? null,
          };
        }),
      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          memberships: [],
          activeWorkspaceId: null,
        }),

      activeMembership: () => {
        const { memberships, activeWorkspaceId } = get();
        return memberships.find((m) => m.workspace.id === activeWorkspaceId) ?? null;
      },
      activeRole: () => get().activeMembership()?.role ?? null,
    }),
    {
      name: "ttm-auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        memberships: s.memberships,
        activeWorkspaceId: s.activeWorkspaceId,
      }),
    },
  ),
);
