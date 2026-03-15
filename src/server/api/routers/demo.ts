import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import {
	getOrCreateDemoSession,
	deactivateDemoSession,
	findDemoSession,
} from "~/server/services/demo/demo-session.service";
import {
	resetDemoOverlay,
	hasUnsavedChanges,
	getUiState,
	updateUiState,
} from "~/server/services/demo/demo-overlay.service";

export const demoRouter = createTRPCRouter({
	/**
	 * Enter demo mode — creates or reuses a DemoOverlaySession.
	 * Returns the session key and expiry so the client can set cookies.
	 */
	enterDemoMode: publicProcedure.mutation(async ({ ctx }) => {
		const sessionKey = crypto.randomUUID();
		const userId = ctx.session?.user?.id ?? null;
		const session = await getOrCreateDemoSession({ sessionKey, userId });

		return {
			success: true,
			sessionKey: session.sessionKey,
			expiresAt: session.expiresAt,
		};
	}),

	/**
	 * Exit demo mode — deactivates the overlay session.
	 * The client should clear the demo cookies.
	 */
	exitDemoMode: publicProcedure
		.input(z.object({ sessionKey: z.string() }))
		.mutation(async ({ input }) => {
			await deactivateDemoSession(input.sessionKey);
			return { success: true };
		}),

	/**
	 * Returns the current demo session status.
	 */
	getDemoStatus: publicProcedure.query(async ({ ctx }) => {
		if (!ctx.isDemoMode || !ctx.demoOverlaySessionKey) {
			return {
				isDemoMode: false,
				overlayExpiresAt: null,
				hasUnsavedDemoChanges: false,
				noticeDismissed: false,
			};
		}

		const session = await findDemoSession(ctx.demoOverlaySessionKey);
		if (!session) {
			return {
				isDemoMode: false,
				overlayExpiresAt: null,
				hasUnsavedDemoChanges: false,
				noticeDismissed: false,
			};
		}

		const unsaved = await hasUnsavedChanges(ctx.demoOverlaySessionKey);
		const uiState = await getUiState(ctx.demoOverlaySessionKey);

		return {
			isDemoMode: true,
			overlayExpiresAt: session.expiresAt,
			hasUnsavedDemoChanges: unsaved,
			noticeDismissed: uiState.noticeDismissed ?? false,
		};
	}),

	/**
	 * Clears all temporary demo overlay changes without exiting demo mode.
	 */
	resetDemoOverlay: publicProcedure
		.input(z.object({ sessionKey: z.string() }))
		.mutation(async ({ input }) => {
			await resetDemoOverlay(input.sessionKey);
			return { success: true };
		}),

	/**
	 * Dismisses the first-entry demo notice modal.
	 */
	dismissDemoNotice: publicProcedure
		.input(z.object({ sessionKey: z.string() }))
		.mutation(async ({ input }) => {
			await updateUiState(input.sessionKey, { noticeDismissed: true });
			return { success: true };
		}),
});
