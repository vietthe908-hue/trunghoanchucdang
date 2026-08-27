import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, KeyRound, Pencil, Shield, Trash2, Users, X } from 'lucide-react';
import type { AdminLanternRow, AdminProfileRow } from '@/lib/types';
import {
  adminChangePassword,
  adminDeleteLantern,
  adminUpdateLantern,
  adminUpdateProfile,
  fetchAdminLanterns,
  fetchAdminProfiles,
} from '@/lib/admin';

type Tab = 'members' | 'lanterns';

function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('members');
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([]);
  const [lanterns, setLanterns] = useState<AdminLanternRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [editingMember, setEditingMember] = useState<AdminProfileRow | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminProfileRow | null>(null);
  const [editingLantern, setEditingLantern] = useState<AdminLanternRow | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  };

  const refreshProfiles = async () => {
    try {
      setProfiles(await fetchAdminProfiles());
    } catch {
      showToast('Không thể tải danh sách thành viên.');
    }
  };

  const refreshLanterns = async () => {
    try {
      setLanterns(await fetchAdminLanterns());
    } catch {
      showToast('Không thể tải danh sách hoa đăng.');
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([refreshProfiles(), refreshLanterns()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <Shield size={22} aria-hidden="true" />
          <div>
            <strong>BẢN QUẢN TRỊ</strong>
            <small>TRÙNG HOAN TÁI · CHÚC ĐĂNG HỘI</small>
          </div>
        </div>
        <button className="admin-back" onClick={onClose}>
          <ArrowLeft size={16} aria-hidden="true" /> Về trang hội
        </button>
      </header>

      <nav className="admin-tabs">
        <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>
          <Users size={15} aria-hidden="true" /> Thành viên
        </button>
        <button className={tab === 'lanterns' ? 'active' : ''} onClick={() => setTab('lanterns')}>
          <ChevronRight size={15} aria-hidden="true" /> Hoa đăng
        </button>
      </nav>

      {tab === 'members' && (
        <div className="admin-body">
          <div className="admin-stats">
            <div className="stat-card">
              <span className="stat-label">TỔNG THÀNH VIÊN</span>
              <strong>{profiles.length}</strong>
            </div>
          </div>

          {loading ? (
            <p className="admin-empty">Đang tải danh sách…</p>
          ) : profiles.length === 0 ? (
            <p className="admin-empty">Chưa có thành viên nào ghi danh.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tên OC</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td className="cell-name">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="row-avatar" />
                        ) : (
                          <span className="row-avatar placeholder" />
                        )}
                        <span>{p.oc_name}</span>
                      </td>
                      <td className="cell-email">{p.email}</td>
                      <td>
                        <span className={`role-pill role-${p.role}`}>{p.role === 'admin' ? 'Quản trị' : 'Thành viên'}</span>
                      </td>
                      <td className="cell-actions">
                        <button className="mini-btn edit" onClick={() => setEditingMember(p)} title="Chỉnh sửa">
                          <Pencil size={14} aria-hidden="true" /> Sửa
                        </button>
                        <button className="mini-btn pwd" onClick={() => setPasswordTarget(p)} title="Đổi mật khẩu">
                          <KeyRound size={14} aria-hidden="true" /> Mật khẩu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'lanterns' && (
        <div className="admin-body">
          {loading ? (
            <p className="admin-empty">Đang tải danh sách…</p>
          ) : lanterns.length === 0 ? (
            <p className="admin-empty">Chưa có hoa đăng nào được thả.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Người thả</th>
                    <th>Chủ tài khoản</th>
                    <th>Lời chúc</th>
                    <th>Người nhận</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {lanterns.map((l) => (
                    <tr key={l.id}>
                      <td className="cell-name">{l.sender_name}</td>
                      <td>{l.owner_name ?? '—'}</td>
                      <td className="cell-wish">“{l.wish}”</td>
                      <td>{l.recipient_name ?? '—'}</td>
                      <td className="cell-actions">
                        <button className="mini-btn edit" onClick={() => setEditingLantern(l)}>
                          <Pencil size={14} aria-hidden="true" /> Sửa
                        </button>
                        <button
                          className="mini-btn reject"
                          onClick={async () => {
                            try {
                              await adminDeleteLantern(l.id);
                              showToast('Đã xoá hoa đăng.');
                              await refreshLanterns();
                            } catch {
                              showToast('Không thể xoá hoa đăng.');
                            }
                          }}
                        >
                          <Trash2 size={14} aria-hidden="true" /> Xoá
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editingMember && (
        <EditMemberModal
          profile={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={async () => {
            setEditingMember(null);
            await refreshProfiles();
            showToast('Đã cập nhật hồ sơ.');
          }}
        />
      )}

      {passwordTarget && (
        <ChangePasswordModal
          profile={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onDone={() => {
            setPasswordTarget(null);
            showToast('Đã đổi mật khẩu cho tài khoản.');
          }}
        />
      )}

      {editingLantern && (
        <EditLanternModal
          lantern={editingLantern}
          onClose={() => setEditingLantern(null)}
          onSaved={async () => {
            setEditingLantern(null);
            await refreshLanterns();
            showToast('Đã cập nhật hoa đăng.');
          }}
        />
      )}

      {toast && (
        <div className="admin-toast" role="status" aria-live="polite">
          <Check size={15} aria-hidden="true" /> {toast}
        </div>
      )}
    </div>
  );
}

function EditMemberModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: AdminProfileRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ocName, setOcName] = useState(profile.oc_name);
  const [email, setEmail] = useState(profile.email);
  const [wish, setWish] = useState(profile.wish);
  const [quote, setQuote] = useState(profile.quote);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [role, setRole] = useState<ApprovalStatus | 'admin' | 'member'>(profile.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adminUpdateProfile({
        userId: profile.id,
        ocName,
        email,
        wish,
        quote,
        avatarUrl: avatarUrl || undefined,
        role: role as 'admin' | 'member',
      });
      onSaved();
    } catch {
      setError('Không thể cập nhật. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel admin-edit-panel" role="dialog" aria-modal="true" aria-label="Chỉnh sửa thành viên" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" aria-label="Đóng" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
        <span className="section-kicker">CHỈNH SỬA THÀNH VIÊN</span>
        <h2>{profile.oc_name}</h2>
        <form onSubmit={handleSubmit}>
          <label>Tên OC<input value={ocName} onChange={(e) => setOcName(e.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Trích dẫn<textarea value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={300} /></label>
          <label>Chúc nguyện<textarea value={wish} onChange={(e) => setWish(e.target.value)} maxLength={500} /></label>
          <label>Link ảnh đại diện<input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" /></label>
          <label>Vai trò
            <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')}>
              <option value="member">Thành viên</option>
              <option value="admin">Quản trị</option>
            </select>
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button full-button" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ChangePasswordModal({
  profile,
  onClose,
  onDone,
}: {
  profile: AdminProfileRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminChangePassword(profile.id, newPassword);
      onDone();
    } catch {
      setError('Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel admin-edit-panel" role="dialog" aria-modal="true" aria-label="Đổi mật khẩu" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" aria-label="Đóng" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
        <span className="section-kicker">ĐỔI MẬT KHẨU</span>
        <h2>{profile.oc_name}</h2>
        <p className="modal-intro">Đặt mật khẩu mới cho tài khoản <strong>{profile.email}</strong>.</p>
        <form onSubmit={handleSubmit}>
          <label>Mật khẩu mới<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button full-button" disabled={saving}>
            {saving ? 'Đang đổi…' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}

function EditLanternModal({
  lantern,
  onClose,
  onSaved,
}: {
  lantern: AdminLanternRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [senderName, setSenderName] = useState(lantern.sender_name);
  const [wish, setWish] = useState(lantern.wish);
  const [recipientName, setRecipientName] = useState(lantern.recipient_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adminUpdateLantern({
        lanternId: lantern.id,
        senderName,
        wish,
        recipientName: recipientName || undefined,
      });
      onSaved();
    } catch {
      setError('Không thể cập nhật. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel admin-edit-panel" role="dialog" aria-modal="true" aria-label="Chỉnh sửa hoa đăng" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" aria-label="Đóng" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
        <span className="section-kicker">CHỈNH SỬA HOA ĐĂNG</span>
        <h2>Đăng số {lantern.style_index}</h2>
        <form onSubmit={handleSubmit}>
          <label>Tên người thả<input value={senderName} onChange={(e) => setSenderName(e.target.value)} required /></label>
          <label>Lời chúc<textarea value={wish} onChange={(e) => setWish(e.target.value)} maxLength={500} required /></label>
          <label>Người nhận<input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button full-button" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminPanel;
