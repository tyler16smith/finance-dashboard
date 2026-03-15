"use client";

import {
	BarChart3,
	FlaskConical,
	LineChart,
	List,
	PieChart,
	Tag,
	TrendingUp,
	Upload,
	Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemoMode } from "~/context/demo-mode-context";
import { cn } from "~/lib/utils";

const navItems = [
	{ href: "/dashboard", label: "Overview", icon: BarChart3 },
	{ href: "/dashboard/transactions", label: "Transactions", icon: List },
	{ href: "/dashboard/rules", label: "Rules", icon: Zap },
	{ href: "/dashboard/investments", label: "Investments", icon: TrendingUp },
	{ href: "/dashboard/scenarios", label: "Scenarios", icon: LineChart },
	{ href: "/dashboard/spending", label: "Spending", icon: PieChart },
	{ href: "/dashboard/categories", label: "Categories", icon: Tag },
];

export function Sidebar() {
	const pathname = usePathname();
	const { isDemoMode, enterDemoMode } = useDemoMode();

	return (
		<aside className="flex h-full w-64 flex-col border-r bg-card">
			<div className="flex h-16 items-center border-b px-6">
				<Image src="/fin-f.svg" alt="Fin logo" width={28} height={28} />
				<span className="font-semibold text-lg">Fin</span>
			</div>
			<nav className="flex flex-1 flex-col gap-1 p-3">
				{navItems.map((item) => {
					const Icon = item.icon;
					const active =
						item.href === "/dashboard"
							? pathname === "/dashboard"
							: pathname.startsWith(item.href);
					return (
						<Link
							className={cn(
								"flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
								active
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
							href={item.href}
							key={item.href}
						>
							<Icon className="h-4 w-4" />
							{item.label}
						</Link>
					);
				})}
				<div className="mt-auto border-t pt-3 space-y-1">
					{!isDemoMode && (
						<button
							type="button"
							className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
							onClick={() => void enterDemoMode()}
						>
							<FlaskConical className="h-4 w-4" />
							Enter Demo Mode
						</button>
					)}
					<Link
						className="flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
						href="/onboarding"
					>
						<Upload className="h-4 w-4" />
						Import data
					</Link>
				</div>
			</nav>
		</aside>
	);
}
