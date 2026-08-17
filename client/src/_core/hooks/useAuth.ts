import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

function getCurrentPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const [, setLocation] = useLocation();
  const finalRedirectPath =
    redirectPath ||
    (redirectOnUnauthenticated
      ? `/auth?next=${encodeURIComponent(getCurrentPath())}`
      : "#");
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const loading = meQuery.isLoading || logoutMutation.isPending;
  const user = meQuery.data ?? null;

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || user) return;
    if (typeof window === "undefined") return;
    if (!finalRedirectPath || finalRedirectPath === "#") return;
    if (window.location.pathname === "/auth") return;
    setLocation(finalRedirectPath);
  }, [
    finalRedirectPath,
    loading,
    redirectOnUnauthenticated,
    setLocation,
    user,
  ]);

  return {
    user,
    loading,
    error: meQuery.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(user),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
