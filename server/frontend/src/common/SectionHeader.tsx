interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  desc: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
}

export default function SectionHeader({ eyebrow, title, desc, align = "left", tone = "light" }: SectionHeaderProps) {
  const centered = align === "center";
  const titleClass = tone === "dark" ? "text-white" : "text-pisa-ink";
  const descClass = tone === "dark" ? "text-white/68" : "text-slate-600";

  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.24em] text-pisa-blue">{eyebrow}</p>
      <h2 className={`font-display text-3xl font-black leading-tight sm:text-4xl lg:text-5xl ${titleClass}`}>{title}</h2>
      <p className={`mt-5 text-base leading-8 sm:text-lg ${descClass}`}>{desc}</p>
    </div>
  );
}
