import { useEffect, useState } from "preact/hooks";

export type SectionLink = { id: string; label: string };

type Props = {
  sections: SectionLink[];
};

export default function SectionNav({ sections }: Props) {
  const [current, setCurrent] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id;
        if (id) setCurrent(id);
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: [0, 0.15, 0.4, 0.7] },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav class="profile-nav" aria-label="On this page">
      <ol class="profile-nav-list">
        {sections.map((s) => (
          <li>
            <a href={`#${s.id}`} aria-current={current === s.id ? "location" : undefined}>
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
