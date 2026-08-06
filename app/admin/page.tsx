import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAuthUser, isAdminEmail } from "../../lib/auth";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/?auth=required");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="admin-page">
        <section className="admin-card">
          <p className="eyebrow">Setlog Match / 運営</p>
          <h1>運営権限がありません。</h1>
          <p>この画面は登録された運営メールアドレスだけが利用できます。</p>
          <Link className="secondary-button" href="/">参加者画面へ戻る</Link>
        </section>
      </main>
    );
  }
  return <AdminClient adminEmail={user.email} />;
}
