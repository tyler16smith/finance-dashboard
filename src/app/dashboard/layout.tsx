import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DemoAnonymousCta } from "~/components/demo/demo-anonymous-cta";
import { DemoBanner } from "~/components/demo/demo-banner";
import { DemoFirstEntryModal } from "~/components/demo/demo-first-entry-modal";
import { DashboardProviders } from "~/components/layout/dashboard-providers";
import { Sidebar } from "~/components/layout/sidebar";
import { TopNav } from "~/components/layout/topnav";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const cookieStore = await cookies();
	const isDemoMode = cookieStore.get("activeAppContext")?.value === "demo";

	const session = await auth();
	if (!session?.user && !isDemoMode) redirect("/auth/signin");

	// Demo workspace always has data — skip the hasData check in demo mode
	if (!isDemoMode) {
		const hasData = await api.transaction.hasData();
		if (!hasData) redirect("/onboarding");
	}

	return (
		<DashboardProviders>
			<DemoBanner />
			<div className="flex h-screen flex-col overflow-hidden bg-background">
			<DemoAnonymousCta />
			<div className="flex flex-1 overflow-hidden">
				<div className="hidden md:flex">
					<Sidebar />
				</div>
				<div className="flex flex-1 flex-col overflow-hidden">
					<TopNav />
					<main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
				</div>
			</div>
			</div>
			<DemoFirstEntryModal />
		</DashboardProviders>
	);
}
