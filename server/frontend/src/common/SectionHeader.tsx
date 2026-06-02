interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  desc: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
}

export default function SectionHeader({ eyebrow, title, desc, align = "left", tone = "light" }: SectionHeaderProps) {
  const centered = align === "center";
  const titleClass = tone === "dark" 
    ? "text-white font-bold" 
    : "text-slate-900 font-bold bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 bg-clip-text text-transparent";
  const descClass = tone === "dark" ? "text-slate-300/90" : "text-slate-600";

  // Exquisite capsule badge classes
  const badgeClass = tone === "dark"
    ? "border-sky-500/30 bg-sky-950/40 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.06)]"
    : "border-sky-200/50 bg-sky-50/60 text-sky-600 shadow-[0_2px_8px_rgba(14,165,233,0.04)]";

  return (
    <div className={centered ? "mx-auto max-w-3xl text-center flex flex-col items-center" : "max-w-3xl flex flex-col items-start"}>
      <div className={`mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-extrabold tracking-widest uppercase ${badgeClass} backdrop-blur-sm transition-all duration-300 hover:border-sky-400/40 hover:scale-[1.02]`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
        <span className="tracking-[0.2em] font-sans antialiased">{eyebrow}</span>
      </div>
      <h2 className={`font-display text-3xl font-black tracking-tight leading-tight sm:text-4xl lg:text-5xl ${titleClass}`}>
        {title}
      </h2>
      <p className={`mt-5 text-base leading-8 sm:text-lg sm:leading-9 ${descClass} max-w-2xl`}>
        {desc}
      </p>
    </div>
  );
}

