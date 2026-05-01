import React, { useEffect, useState, useCallback } from "react";
import { getMembers, addMember, updateMemberRole, removeMember } from "../api/members";
import { Member, MemberRole } from "../types";
import { format } from "date-fns";

const ROLE_LABELS: Record<MemberRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

const ROLE_CLS: Record<MemberRole, string> = {
  ADMIN: "pm-role-admin",
  MANAGER: "pm-role-manager",
  MEMBER: "pm-role-member",
  VIEWER: "pm-role-viewer",
};

const AVATAR_GRADIENTS = [
  "", "pm-avatar-2", "pm-avatar-3", "pm-avatar-4", "pm-avatar-5",
];

function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

const PERMS = [
  { label: "View dashboard & launches", access: { ADMIN: true, MANAGER: true, MEMBER: true, VIEWER: true } },
  { label: "Run / re-run tests",         access: { ADMIN: true, MANAGER: true, MEMBER: true, VIEWER: false } },
  { label: "Classify defects",           access: { ADMIN: true, MANAGER: true, MEMBER: true, VIEWER: false } },
  { label: "Link external issues",       access: { ADMIN: true, MANAGER: true, MEMBER: false, VIEWER: false } },
  { label: "Delete launches",            access: { ADMIN: true, MANAGER: false, MEMBER: false, VIEWER: false } },
  { label: "Invite & manage members",    access: { ADMIN: true, MANAGER: false, MEMBER: false, VIEWER: false } },
  { label: "Configure project settings", access: { ADMIN: true, MANAGER: false, MEMBER: false, VIEWER: false } },
];

const PermissionModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ROLES: MemberRole[] = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="rp-modal-overlay" onClick={onClose}>
      <div className="pm-permission-modal" onClick={e => e.stopPropagation()}>
        <div className="rp-modal-head">
          <span className="rp-modal-title">Permission Map</span>
          <span className="rp-modal-subtitle">What each role can do</span>
          <button className="rp-modal-close" onClick={onClose}>
            <kbd>Esc</kbd>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{maxHeight: "60vh", overflow: "auto"}}>
          <table className="pm-perm-table">
            <thead>
              <tr>
                <th style={{width: "40%"}}>Permission</th>
                {ROLES.map(r => <th key={r} className="center" style={{width: "15%"}}>{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMS.map(p => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  {ROLES.map(r => (
                    <td key={r} className="center" style={{textAlign: "center"}}>
                      {p.access[r] ? <span className="pm-perm-yes">&check;</span> : <span className="pm-perm-no">&mdash;</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rp-modal-foot" style={{justifyContent: "flex-end"}}>
          <button className="rp-modal-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

const InviteModal: React.FC<{
  onClose: () => void;
  onInvite: (name: string, email: string, role: MemberRole) => void;
  submitting: boolean;
}> = ({ onClose, onInvite, submitting }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("MEMBER");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = () => {
    if (name.trim() && email.trim()) {
      onInvite(name.trim(), email.trim(), role);
    }
  };

  return (
    <div className="rp-modal-overlay" onClick={onClose}>
      <div className="pm-invite-modal" onClick={e => e.stopPropagation()}>
        <div className="rp-modal-head">
          <span className="rp-modal-title">Invite User</span>
          <button className="rp-modal-close" onClick={onClose}>
            <kbd>Esc</kbd>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="pm-invite-form">
          <div>
            <label>Full name</label>
            <input type="text" placeholder="Jane Doe" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label>Email</label>
            <input type="email" placeholder="teammate@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label>Project role</label>
            <select value={role} onChange={e => setRole(e.target.value as MemberRole)}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
        </div>
        <div className="rp-modal-foot" style={{justifyContent: "flex-end"}}>
          <button className="rp-modal-cancel" onClick={onClose}>Cancel</button>
          <button
            className="rp-modal-apply"
            onClick={handleSubmit}
            disabled={!name.trim() || !email.trim() || submitting}
          >
            {submitting ? "Sending..." : "Send invite"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Members: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [permOpen, setPermOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMembers()
      .then((res) => setMembers(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = members.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = (name: string, email: string, role: MemberRole) => {
    setSubmitting(true);
    addMember({ name, email, role })
      .then(() => {
        setInviteOpen(false);
        load();
      })
      .finally(() => setSubmitting(false));
  };

  const handleRoleChange = (id: number, newRole: MemberRole) => {
    updateMemberRole(id, newRole).then(() => load());
  };

  const handleRemove = (id: number) => {
    if (!window.confirm("Remove this member from the project?")) return;
    removeMember(id).then(() => load());
  };

  return (
    <div>
      <div className="page-title-row" style={{marginBottom: 18}}>
        <h1 className="page-title" style={{margin: 0}}>Project Members</h1>
        <span style={{marginLeft: 12, color: "var(--color-text-muted)", fontSize: 13}}>
          {members.length} member{members.length !== 1 ? "s" : ""} on this project
        </span>
      </div>

      <div className="pm-toolbar">
        <div className="pm-search">
          <span className="pm-search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="pm-permission-link" onClick={() => setPermOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4"/><circle cx="12" cy="7" r="4"/></svg>
          Permission Map
        </button>
        <div className="pm-toolbar-spacer" />
        <button className="pm-invite-btn" onClick={() => setInviteOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Invite User
        </button>
      </div>

      {loading ? (
        <div className="loading-center">
          <div className="spinner spinner-lg" />
        </div>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th style={{width: "40%"}}>Name / Email</th>
                <th style={{width: "20%"}}>Joined</th>
                <th style={{width: "25%"}}>Project role</th>
                <th style={{width: "15%"}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => (
                <tr key={m.id}>
                  <td>
                    <div className="pm-name-cell">
                      <span className={`pm-avatar ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`}>
                        {initials(m.name)}
                      </span>
                      <div>
                        <div>
                          <span className="pm-name">{m.name}</span>
                        </div>
                        <div className="pm-login">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="pm-last-login">
                    {format(new Date(m.created_at), "MMM d, yyyy")}
                  </td>
                  <td>
                    <select
                      className={`pm-role-select ${ROLE_CLS[m.role] || ""}`}
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value as MemberRole)}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="MEMBER">MEMBER</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </td>
                  <td>
                    <button className="pm-action-btn" onClick={() => handleRemove(m.id)}>
                      Unassign
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{textAlign: "center", padding: 32, color: "var(--color-text-muted)"}}>
                    {search ? `No members match "${search}".` : "No members yet. Invite your first team member."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {permOpen && <PermissionModal onClose={() => setPermOpen(false)} />}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvite={handleInvite} submitting={submitting} />}
    </div>
  );
};

export default Members;
