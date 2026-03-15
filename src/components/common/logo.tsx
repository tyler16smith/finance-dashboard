const sizeMap = {
	sm: 20,
	md: 24,
	lg: 28,
};

interface LogoProps {
	size?: "sm" | "md" | "lg";
}

export default function Logo({ size = "md" }: LogoProps) {
	return (
		<span
			className="flex items-center gap-1 font-semibold"
			style={{ fontSize: sizeMap[size] }}
		>
			<img
				src="/fin-logo.svg"
				alt="Fin logo"
				style={{ width: sizeMap[size], height: sizeMap[size] }}
			/>
			Fin
		</span>
	);
}
