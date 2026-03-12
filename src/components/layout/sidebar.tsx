"use client";

import {
	BarChart3,
	DollarSign,
	LineChart,
	PieChart,
	TrendingUp,
	Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

const navItems = [
	{ href: "/dashboard", label: "Overview", icon: BarChart3 },
	{ href: "/dashboard/investments", label: "Investments", icon: TrendingUp },
	{ href: "/dashboard/scenarios", label: "Scenarios", icon: LineChart },
	{ href: "/dashboard/spending", label: "Spending", icon: PieChart },
];

export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside className="flex h-full w-64 flex-col border-r bg-card">
			<div className="flex h-16 items-center gap-2 border-b px-6">
				<DollarSign className="h-6 w-6 text-primary" />
				<span className="font-semibold text-lg">FinanceDash</span>
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
				<div className="mt-auto border-t pt-3">
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
