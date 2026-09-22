import { currentUser } from "../../lib/api";

export default async function AccountPage() {
  const user = await currentUser();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p>Review the identity attached to your DealOS workspace.</p>
        </div>
      </div>
      <section className="card card-pad" style={{ maxWidth:680 }}>
        <div className="list">
          <div className="list-row"><span className="muted">Name</span><strong>{user.name}</strong></div>
          <div className="list-row"><span className="muted">Email</span><strong>{user.email}</strong></div>
          <div className="list-row"><span className="muted">Account type</span><strong style={{ textTransform:"capitalize" }}>{user.role.toLowerCase()}</strong></div>
          <div className="list-row"><span className="muted">Member since</span><strong>{new Date(user.createdAt).toLocaleDateString("en-NG")}</strong></div>
        </div>
      </section>
    </>
  );
}
