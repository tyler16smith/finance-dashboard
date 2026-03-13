"use client";

import {
	Banknote,
	Briefcase,
	Car,
	CreditCard,
	Dumbbell,
	Film,
	Fuel,
	Gift,
	GraduationCap,
	Heart,
	Home,
	Plane,
	Receipt,
	Salad,
	ShieldCheck,
	ShoppingBag,
	Shirt,
	Stethoscope,
	TrendingUp,
	Utensils,
	Wallet,
	Zap,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

const CATEGORY_GROUPS: {
	title: string;
	color: string;
	bgColor: string;
	categories: { name: string; icon: React.ElementType }[];
}[] = [
	{
		title: "Income",
		color: "text-emerald-600",
		bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
		categories: [
			{ name: "Salary", icon: Wallet },
			{ name: "Reimbursement", icon: Receipt },
		],
	},
	{
		title: "Food & Dining",
		color: "text-orange-600",
		bgColor: "bg-orange-50 dark:bg-orange-950/30",
		categories: [
			{ name: "Eating Out", icon: Utensils },
			{ name: "Groceries", icon: Salad },
		],
	},
	{
		title: "Housing",
		color: "text-blue-600",
		bgColor: "bg-blue-50 dark:bg-blue-950/30",
		categories: [
			{ name: "Mortgage & Rent", icon: Home },
			{ name: "Home", icon: Home },
			{ name: "Bills & Utilities", icon: Zap },
			{ name: "Insurance", icon: ShieldCheck },
		],
	},
	{
		title: "Transportation",
		color: "text-violet-600",
		bgColor: "bg-violet-50 dark:bg-violet-950/30",
		categories: [
			{ name: "Auto & Transport", icon: Car },
			{ name: "Gas", icon: Fuel },
			{ name: "Cars", icon: Car },
			{ name: "Travel", icon: Plane },
			{ name: "Flights", icon: Plane },
		],
	},
	{
		title: "Shopping & Lifestyle",
		color: "text-pink-600",
		bgColor: "bg-pink-50 dark:bg-pink-950/30",
		categories: [
			{ name: "Shopping", icon: ShoppingBag },
			{ name: "Clothing", icon: Shirt },
			{ name: "Entertainment", icon: Film },
			{ name: "Sports & Fitness", icon: Dumbbell },
		],
	},
	{
		title: "Health & Family",
		color: "text-red-600",
		bgColor: "bg-red-50 dark:bg-red-950/30",
		categories: [
			{ name: "Health & Medical", icon: Stethoscope },
			{ name: "Kids", icon: GraduationCap },
			{ name: "Gifts & Donations", icon: Gift },
		],
	},
	{
		title: "Business & Finance",
		color: "text-slate-600",
		bgColor: "bg-slate-50 dark:bg-slate-950/30",
		categories: [
			{ name: "Business Services", icon: Briefcase },
			{ name: "Investments", icon: TrendingUp },
			{ name: "Loans", icon: Banknote },
			{ name: "Taxes", icon: Receipt },
			{ name: "Fees", icon: CreditCard },
		],
	},
	{
		title: "Other",
		color: "text-gray-500",
		bgColor: "bg-gray-50 dark:bg-gray-950/30",
		categories: [{ name: "Uncategorized", icon: Heart }],
	},
];

export default function CategoriesPage() {
	const [newName, setNewName] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");

	const utils = api.useUtils();

	const { data: categories, isLoading } = api.category.list.useQuery();

	const defaultCategories = categories?.filter((c) => c.isDefault) ?? [];
	const userCategories = categories?.filter((c) => !c.isDefault) ?? [];

	const createCategory = api.category.create.useMutation({
		onSuccess: () => {
			void utils.category.list.invalidate();
			setNewName("");
			toast.success("Category created");
		},
		onError: () => toast.error("Failed to create category"),
	});

	const updateCategory = api.category.update.useMutation({
		onSuccess: () => {
			void utils.category.list.invalidate();
			setEditingId(null);
			setEditingName("");
			toast.success("Category renamed");
		},
		onError: () => toast.error("Failed to rename category"),
	});

	const deleteCategory = api.category.delete.useMutation({
		onSuccess: () => {
			void utils.category.list.invalidate();
			toast.success("Category deleted");
		},
		onError: () => toast.error("Failed to delete category"),
	});

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = newName.trim();
		if (!trimmed) return;
		createCategory.mutate({ name: trimmed });
	}

	function startEdit(id: string, name: string) {
		setEditingId(id);
		setEditingName(name);
	}

	function commitEdit(id: string) {
		const trimmed = editingName.trim();
		if (!trimmed) {
			setEditingId(null);
			return;
		}
		updateCategory.mutate({ id, name: trimmed });
	}

	function cancelEdit() {
		setEditingId(null);
		setEditingName("");
	}

	function handleEditKeyDown(
		e: React.KeyboardEvent<HTMLInputElement>,
		id: string,
	) {
		if (e.key === "Enter") {
			e.preventDefault();
			commitEdit(id);
		} else if (e.key === "Escape") {
			cancelEdit();
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">Categories</h1>
				<p className="text-muted-foreground text-sm">
					Manage your spending categories
				</p>
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Your Categories</CardTitle>
					<p className="text-muted-foreground text-sm">
						Custom categories you&apos;ve created
					</p>
				</CardHeader>
				<CardContent className="space-y-4">
					{isLoading ? (
						<p className="text-sm text-muted-foreground">Loading...</p>
					) : userCategories.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No custom categories yet. Add one below.
						</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{userCategories.map((cat) =>
								editingId === cat.id ? (
									<Input
										key={cat.id}
										autoFocus
										className="h-8 w-40 text-sm"
										value={editingName}
										onBlur={() => commitEdit(cat.id)}
										onChange={(e) => setEditingName(e.target.value)}
										onKeyDown={(e) => handleEditKeyDown(e, cat.id)}
									/>
								) : (
									<div
										key={cat.id}
										className="flex items-center gap-1 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm transition-colors hover:bg-muted"
									>
										<button
											type="button"
											className="transition-colors hover:text-foreground"
											onClick={() => startEdit(cat.id, cat.name)}
										>
											{cat.name}
										</button>
										<button
											type="button"
											className="ml-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
											disabled={deleteCategory.isPending}
											onClick={() => deleteCategory.mutate({ id: cat.id })}
										>
											<X className="h-3.5 w-3.5" />
										</button>
									</div>
								),
							)}
						</div>
					)}

					<form className="flex items-center gap-2" onSubmit={handleCreate}>
						<Input
							className="h-8 max-w-xs text-sm"
							placeholder="New category name"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<Button
							type="submit"
							className="h-8"
							disabled={!newName.trim() || createCategory.isPending}
							size="sm"
						>
							Add
						</Button>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Default Categories</CardTitle>
					<p className="text-muted-foreground text-sm">
						Built-in categories for common transactions
					</p>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<p className="text-sm text-muted-foreground">Loading...</p>
					) : (
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{CATEGORY_GROUPS.map((group) => (
								<div
									key={group.title}
									className={`rounded-lg border p-3 ${group.bgColor}`}
								>
									<h3
										className={`mb-2 text-xs font-semibold uppercase tracking-wide ${group.color}`}
									>
										{group.title}
									</h3>
									<ul className="space-y-1">
										{group.categories.map((cat) => {
											const Icon = cat.icon;
											const exists = defaultCategories.some(
												(c) => c.name === cat.name,
											);
											if (!exists) return null;
											return (
												<li
													key={cat.name}
													className="flex items-center gap-2 text-sm"
												>
													<Icon className={`h-3.5 w-3.5 ${group.color}`} />
													<span>{cat.name}</span>
												</li>
											);
										})}
									</ul>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
