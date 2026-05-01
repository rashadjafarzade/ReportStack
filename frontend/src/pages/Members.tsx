import React, { useEffect, useState } from "react";
import { getMembers, addMember, updateMemberRole, removeMember } from "../api/members";
import { Member, MemberRole } from "../types";
import { format } from "date-fns";

const ROLE_LABELS: Record<MemberRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

const Members: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("MEMBER");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    getMembers()
      .then((res) => setMembers(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    addMember({ name: name.trim(), email: email.trim(), role })
      .then(() => {
        setName("");
        setEmail("");
        setRole("MEMBER");
        setShowForm(false);
        load();
      })
      .finally(() => setSubmitting(false));
  };

  const handleRoleChange = (id: number, newRole: MemberRole) => {
    updateMemberRole(id, newRole).then(() => load());
  };

  const handleRemove = (id: number) => {
    if (!window.confirm("Remove this member?")) return;
    removeMember(id).then(() => load());
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Project Members</h1>
            <p className="page-subtitle">Manage team members and their roles</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Member"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card mb-6">
          <div className="card-body">
            <form onSubmit={handleAdd} className="flex gap-3 items-end" style={{ flexWrap: "wrap" }}>
              <div className="flex flex-col gap-1" style={{ flex: "1 1 180px" }}>
                <label className="text-sm font-medium">Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="flex flex-col gap-1" style={{ flex: "1 1 220px" }}>
                <label className="text-sm font-medium">Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
              </div>
              <div className="flex flex-col gap-1" style={{ flex: "0 0 140px" }}>
                <label className="text-sm font-medium">Role</label>
                <select className="select" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || !name.trim() || !email.trim()}>
                {submitting ? "Adding..." : "Add"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Members ({members.length})</h3>
        </div>
        {loading ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#128101;</div>
            <div className="empty-state-title">No Members Yet</div>
            <div className="empty-state-description">Add team members to collaborate on test reports.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th style={{ width: 140 }}>Role</th>
                <th style={{ width: 160 }}>Joined</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="comment-avatar">{m.name.charAt(0).toUpperCase()}</span>
                      <span className="cell-name">{m.name}</span>
                    </div>
                  </td>
                  <td className="cell-secondary">{m.email}</td>
                  <td>
                    <select
                      className="select defect-status-select"
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  </td>
                  <td className="cell-secondary">
                    {format(new Date(m.created_at), "MMM d, yyyy")}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRemove(m.id)} title="Remove" style={{ color: "var(--color-failed)" }}>
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Members;
