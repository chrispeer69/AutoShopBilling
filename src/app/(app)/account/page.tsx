import { requireSession } from "@/lib/auth";
import { changeMyPassword } from "@/lib/actions";
import { Card, CardHeader, Field, inputCls, btnPrimary } from "@/components/ui";
import { AForm } from "@/components/aform";

export default async function AccountPage() {
  const { user } = await requireSession();
  return (
    <div className="max-w-md space-y-5">
      <h1 className="text-2xl font-bold text-steel-900">My Account</h1>
      <Card>
        <CardHeader title="Profile" />
        <div className="p-5 text-sm text-steel-600 space-y-1">
          <div><span className="font-semibold text-steel-900">{user.name}</span> · {user.role === "OWNER" ? "Owner" : "Tech"}</div>
          <div>{user.email}</div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Change password" />
        <div className="p-5">
          <AForm action={changeMyPassword} submitLabel="Change Password" submitClass={btnPrimary} className="space-y-3">
            <Field label="Current password"><input type="password" name="current" className={inputCls} required /></Field>
            <Field label="New password (8+ characters)"><input type="password" name="next" className={inputCls} required minLength={8} /></Field>
          </AForm>
        </div>
      </Card>
    </div>
  );
}
