import Link from "next/link";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export default function LegalPage({
  eyebrow,
  title,
  lead,
  sections,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  sections: LegalSection[];
}) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="brand" href="/" aria-label="set-mobトップへ戻る">
          <span className="brand-mark">sm</span>
          <span><strong>set-mob</strong><small>独立運営サービス</small></span>
        </Link>
        <Link className="secondary-button" href="/">参加画面へ</Link>
      </header>
      <article className="legal-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-lead">{lead}</p>
        <p className="legal-updated">制定・最終更新：2026年8月13日</p>
        {sections.map((section) => (
          <section className="legal-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
          </section>
        ))}
        <aside className="legal-contact">
          <strong>運営・問い合わせ</strong>
          <span>長谷川 峻平</span>
          <a href="mailto:s.hasegawa1130@gmail.com">s.hasegawa1130@gmail.com</a>
        </aside>
      </article>
    </main>
  );
}
