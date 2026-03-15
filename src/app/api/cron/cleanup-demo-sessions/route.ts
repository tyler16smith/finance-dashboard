import { NextResponse } from "next/server";
import { cleanupExpiredDemoSessions } from "~/server/services/demo/demo-session.service";

/**
 * Cron endpoint to clean up expired DemoOverlaySession records.
 * Call this from a cron job (e.g., Vercel Cron, an external scheduler) at a regular interval.
 *
 * Secure with a CRON_SECRET env variable to prevent unauthorized access.
 */
export async function GET(request: Request) {
	const authHeader = request.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;

	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const deleted = await cleanupExpiredDemoSessions();
		return NextResponse.json({ success: true, deletedCount: deleted });
	} catch (error) {
		console.error("[cron] cleanup-demo-sessions failed:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
