import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { PatchCache } from "./types";
import { fuzzyScore } from "./utils";

export default function CategoryCell({
	allCategories,
	category,
	patchCache,
	transactionId,
}: {
	allCategories: string[];
	category: string;
	patchCache: PatchCache;
	transactionId: string;
}) {
	const [editing, setEditing] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const [activeIndex, setActiveIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);

	const updateCategory = api.transaction.updateCategory.useMutation({
		onSuccess: (result, vars) => {
			patchCache((tx) =>
				tx.id === vars.id
					? {
							...tx,
							category: result.categoryName,
							categoryRef: { name: result.categoryName },
						}
					: tx,
			);
		},
		onError: () => toast.error("Failed to update category"),
	});

	const suggestions = useMemo(() => {
		const cats = [...allCategories];
		const query = inputValue.trim();
		if (!query) return cats.slice(0, 6);
		return cats
			.map((c) => ({ name: c, score: fuzzyScore(c, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 6)
			.map((x) => x.name);
	}, [inputValue, allCategories]);

	useEffect(() => {
		if (editing) {
			setInputValue(category);
			setTimeout(() => {
				inputRef.current?.focus();
				inputRef.current?.select();
			}, 0);
		}
	}, [editing, category]);

	function commit(value: string) {
		const trimmed = value.trim();
		if (trimmed && trimmed !== category) {
			updateCategory.mutate({ id: transactionId, categoryName: trimmed });
		}
		setEditing(false);
		setInputValue("");
		setActiveIndex(-1);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, -1));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const chosen = activeIndex >= 0 ? suggestions[activeIndex] : inputValue;
			commit(chosen ?? inputValue);
		} else if (e.key === "Escape") {
			setEditing(false);
			setInputValue("");
			setActiveIndex(-1);
		}
	}

	function handleBlur() {
		setTimeout(() => commit(inputValue), 120);
	}

	if (editing) {
		return (
			<div className="relative">
				<input
					ref={inputRef}
					className="w-32 rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
					onBlur={handleBlur}
					onChange={(e) => {
						setInputValue(e.target.value);
						setActiveIndex(-1);
					}}
					onKeyDown={handleKeyDown}
					value={inputValue}
				/>
				{suggestions.length > 0 && (
					<ul className="absolute left-0 top-full z-50 mt-1 min-w-[8rem] rounded-md border bg-popover py-1 shadow-md">
						{suggestions.map((name, i) => (
							<li key={name}>
								<button
									type="button"
									className={[
										"w-full px-3 py-1 text-left text-xs transition-colors",
										i === activeIndex
											? "bg-accent text-accent-foreground"
											: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
									].join(" ")}
									onMouseDown={(e) => {
										e.preventDefault();
										commit(name);
									}}
								>
									{name}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		);
	}

	return (
		<button
			type="button"
			className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/80"
			onClick={() => setEditing(true)}
		>
			{category || "—"}
		</button>
	);
}
