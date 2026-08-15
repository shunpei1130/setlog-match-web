import Link from "next/link";
import DeleteAccountPanel from "./delete-account-panel";

export default function ContactPage() {
  return (
    <main className="legal-page">
      <header className="legal-header"><Link className="brand" href="/"><span className="brand-mark">sm</span><span><strong>set-mob</strong><small>独立運営サービス</small></span></Link><Link className="secondary-button" href="/">参加画面へ</Link></header>
      <article className="legal-content">
        <p className="eyebrow">CONTACT / DELETE</p><h1>問い合わせ・削除</h1>
        <p className="legal-lead">安全相談、登録内容、退会・削除について運営へ連絡できます。</p>
        <section className="legal-section"><h2>メールで問い合わせる</h2><p>登録に使ったメールアドレスから、要件と発生日時をお知らせください。認証コードやパスワードは送らないでください。</p><a className="primary-button" href="mailto:s.hasegawa1130@gmail.com?subject=set-mob%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B">運営へメールする</a></section>
        <section className="legal-section"><h2>ブロック・通報</h2><p>進行中のDay Pairは、参加画面の「安全メニュー」からブロック・通報してください。緊急の危険は110または119へ連絡してください。</p><Link href="/safety">安全ガイドを確認</Link></section>
        <DeleteAccountPanel />
        <aside className="legal-contact"><strong>運営</strong><span>長谷川 峻平</span><a href="mailto:s.hasegawa1130@gmail.com">s.hasegawa1130@gmail.com</a></aside>
      </article>
    </main>
  );
}
