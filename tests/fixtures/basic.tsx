export function Header() {
	return (
		<header className="shrink-0">
			<div className="flex h-[72px] items-center justify-between px-[50px]">
				<h1 className="text-[20px] font-bold">Title</h1>
			</div>
		</header>
	);
}

export function Card() {
	return (
		<div className="rounded-[4px] p-[16px] bg-[#3b82f6]">
			<p className="text-[14px] leading-[20px]">Content</p>
		</div>
	);
}
