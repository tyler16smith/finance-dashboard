"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";

interface DemoModeContextValue {
	isDemoMode: boolean;
	overlayExpiresAt: Date | null;
	hasUnsavedDemoChanges: boolean;
	noticeDismissed: boolean;
	enterDemoMode: () => Promise<void>;
	exitDemoMode: () => Promise<void>;
	resetDemoOverlay: () => Promise<void>;
	dismissDemoNotice: () => Promise<void>;
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

function getCookie(name: string): string | null {
	if (typeof document === "undefined") return null;
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]!) : null;
}

function setCookie(name: string, value: string, days?: number) {
	let expires = "";
	if (days) {
		const d = new Date();
		d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
		expires = `; expires=${d.toUTCString()}`;
	}
	document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
	const [isDemoMode, setIsDemoMode] = useState(() => {
		if (typeof document !== "undefined") {
			return getCookie("activeAppContext") === "demo";
		}
		return false;
	});
	const [overlayExpiresAt, setOverlayExpiresAt] = useState<Date | null>(null);
	const [hasUnsavedDemoChanges, setHasUnsavedDemoChanges] = useState(false);
	const [noticeDismissed, setNoticeDismissed] = useState(false);

	const { data: session } = useSession();
	const utils = api.useUtils();

	const enterDemoModeMutation = api.demo.enterDemoMode.useMutation();
	const exitDemoModeMutation = api.demo.exitDemoMode.useMutation();
	const resetOverlayMutation = api.demo.resetDemoOverlay.useMutation();
	const dismissNoticeMutation = api.demo.dismissDemoNotice.useMutation();

	// Sync status on mount
	const { data: status } = api.demo.getDemoStatus.useQuery(undefined, {
		enabled: isDemoMode,
		refetchOnWindowFocus: false,
	});

	useEffect(() => {
		if (status) {
			setIsDemoMode(status.isDemoMode);
			setOverlayExpiresAt(status.overlayExpiresAt ? new Date(status.overlayExpiresAt) : null);
			setHasUnsavedDemoChanges(status.hasUnsavedDemoChanges);
			setNoticeDismissed(status.noticeDismissed);
		}
	}, [status]);

	const enterDemoMode = useCallback(async () => {
		const result = await enterDemoModeMutation.mutateAsync();
		setCookie("activeAppContext", "demo", 7);
		setCookie("demoOverlaySessionKey", result.sessionKey, 7);
		setIsDemoMode(true);
		setOverlayExpiresAt(new Date(result.expiresAt));
		// Reload to re-render all server components with demo context
		window.location.reload();
	}, [enterDemoModeMutation]);

	const exitDemoMode = useCallback(async () => {
		const sessionKey = getCookie("demoOverlaySessionKey");
		if (sessionKey) {
			await exitDemoModeMutation.mutateAsync({ sessionKey });
		}
		deleteCookie("activeAppContext");
		deleteCookie("demoOverlaySessionKey");
		setIsDemoMode(false);
		setHasUnsavedDemoChanges(false);
		setOverlayExpiresAt(null);
		// Anonymous users go to sign-in; authenticated users reload in place
		if (!session?.user) {
			window.location.href = "/auth/signin";
		} else {
			window.location.reload();
		}
	}, [exitDemoModeMutation, session]);

	const resetDemoOverlay = useCallback(async () => {
		const sessionKey = getCookie("demoOverlaySessionKey");
		if (!sessionKey) return;
		await resetOverlayMutation.mutateAsync({ sessionKey });
		setHasUnsavedDemoChanges(false);
		await utils.invalidate();
	}, [resetOverlayMutation, utils]);

	const dismissDemoNotice = useCallback(async () => {
		const sessionKey = getCookie("demoOverlaySessionKey");
		if (!sessionKey) return;
		await dismissNoticeMutation.mutateAsync({ sessionKey });
		setNoticeDismissed(true);
	}, [dismissNoticeMutation]);

	return (
		<DemoModeContext.Provider
			value={{
				isDemoMode,
				overlayExpiresAt,
				hasUnsavedDemoChanges,
				noticeDismissed,
				enterDemoMode,
				exitDemoMode,
				resetDemoOverlay,
				dismissDemoNotice,
			}}
		>
			{children}
		</DemoModeContext.Provider>
	);
}

export function useDemoMode() {
	const ctx = useContext(DemoModeContext);
	if (!ctx) throw new Error("useDemoMode must be used within DemoModeProvider");
	return ctx;
}
