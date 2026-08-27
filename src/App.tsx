import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, BookOpen, Check, ChevronDown, CircleUserRound, Crown, Eye, EyeOff, Flame, Flower2, Gem, Gift, LogIn, Menu, Music2, Shield, Sparkles, Star, X } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { createGreetingCard } from '@/lib/greeting';
import { getAudioContext, playChime, startAmbientMusic, stopAmbientMusic, isAmbientPlaying, playCrescendo } from '@/lib/audio';
import AdminPanel from '@/components/AdminPanel';
import GreetingView from '@/components/GreetingView';

type Modal = 'auth' | 'lantern' | 'profile' | 'receiver' | 'editAvatar' | 'editQuote' | 'editWish' | 'lanternGift' | 'giftSuccess' | 'memories' | null;
type AuthMode = 'login' | 'signup';
type LanternMode = 'personal' | 'gift' | null;

type LanternData = {
  id: string;
  style_index: number;
  sender_name: string;
  wish: string;
  recipient_name?: string | null;
};

type Memory = {
  id: string;
  type: 'lantern' | 'gift';
  sender_name: string;
  recipient_name: string | null;
  wish: string;
  style_index: number;
  created_at: string;
  token: string | null;
};

const lanternNames = ['Hồng Liên', 'Nguyệt Bạch', 'Kim Vân', 'Chu Sa', 'Thanh Ngọc', 'Tuyết Mai', 'Phượng Hoàng', 'Bích Hải'];
const seedLanterns: LanternData[] = [
  { id: 'seed-1', style_index: 8, sender_name: 'Mộ Dung Ly', wish: 'Nguyện bình an theo gió về nhà.' },
  { id: 'seed-2', style_index: 31, sender_name: 'Tạ Trường Khanh', wish: 'Cầu cho người hữu duyên gặp lại.' },
  { id: 'seed-3', style_index: 72, sender_name: 'Lục Thanh Dao', wish: 'Mong năm tháng dịu dàng như ý.' },
  { id: 'seed-4', style_index: 116, sender_name: 'Bạch Vân Châu', wish: 'Ước một đời tự tại, an nhiên.' },
];

function getGreetingTokenFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/^#\/view\/(.+)$/);
  return match ? match[1] : null;
}

function App() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [lanternMode, setLanternMode] = useState<LanternMode>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<Profile | null>(null);
  const [lanterns, setLanterns] = useState<LanternData[]>(seedLanterns);
  const [soundOn, setSoundOn] = useState(false);
  const [toast, setToast] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailVisible, setEmailVisible] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [greetingToken, setGreetingToken] = useState<string | null>(null);
  const [releaseAnimation, setReleaseAnimation] = useState(false);
  const [releasedLantern, setReleasedLantern] = useState<{ name: string; wish: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [giftResult, setGiftResult] = useState<{ token: string; senderName: string; recipientName: string; wish: string } | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesTab, setMemoriesTab] = useState<'lantern' | 'gift'>('lantern');
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const fireworkTimersRef = useRef<number[]>([]);

  const ensureProfile = async (): Promise<Profile | null> => {
    const { data, error } = await supabase.rpc('ensure_my_profile');
    if (error) throw new Error(`Không thể khôi phục hồ sơ: ${error.message}`);
    if (!data || data.length === 0) return null;
    return data[0] as Profile;
  };

  useEffect(() => {
    const token = getGreetingTokenFromHash();
    if (token) {
      setGreetingToken(token);
      return;
    }

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        try {
          const profile = await ensureProfile();
          if (profile) setUser(profile);
        } catch {
          setAuthError('Không thể khôi phục hồ sơ. Vui lòng đăng nhập lại.');
        }
      }
    })();

    const authSubscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
      } else if (event === 'SIGNED_IN' && session.user) {
        void (async () => {
          try {
            const profile = await ensureProfile();
            if (profile) setUser(profile);
          } catch {
            setAuthError('Không thể khôi phục hồ sơ. Vui lòng đăng nhập lại.');
          }
        })();
      }
    });

    return () => { void authSubscription.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const sub = supabase
      .channel(`profiles:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
        const updated = payload.new as Profile;
        setUser(updated);
      })
      .subscribe();

    return () => { void supabase.removeChannel(sub); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    return () => {
      fireworkTimersRef.current.forEach((t) => clearTimeout(t));
      stopAmbientMusic();
    };
  }, []);

  useEffect(() => {
    const loadLanterns = async () => {
      const { data } = await supabase.from('lanterns').select('id, style_index, sender_name, wish, recipient_name').order('released_at', { ascending: false }).limit(12);
      if (data?.length) setLanterns(data);
    };
    void loadLanterns();
  }, []);

  const stars = useMemo(() => Array.from({ length: 58 }, (_, index) => ({
    id: index,
    left: `${(index * 37) % 100}%`,
    top: `${8 + ((index * 19) % 58)}%`,
    delay: `${(index % 7) * 0.7}s`,
    size: index % 5 === 0 ? 3 : 2,
  })), []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3800);
  };

  const makeSound = () => {
    if (!soundOn) {
      setSoundOn(true);
      audioRef.current = getAudioContext();
      playChime(523.25, 0.08);
      setTimeout(() => playChime(659.25, 0.06), 120);
      setTimeout(() => playChime(783.99, 0.05), 240);
      startAmbientMusic();
    } else {
      if (isAmbientPlaying()) { stopAmbientMusic(); setSoundOn(false); }
      else { startAmbientMusic(); setSoundOn(true); }
    }
  };

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '').trim();
    try {
      if (authMode === 'signup') {
        if (!name) throw new Error('Vui lòng nhập tên OC.');
        const result = await supabase.auth.signUp({
          email,
          password,
          options: { data: { oc_name: name } },
        });
        if (result.error) throw new Error(result.error.message);
        if (!result.data.user) throw new Error('Không thể tạo tài khoản.');
        if (result.data.session) {
          const loaded = await ensureProfile();
          if (loaded) {
            setUser(loaded);
            showToast('Đã ghi danh. Quý nhân đã bước vào hội.');
          } else {
            showToast('Đã ghi danh. Vui lòng đăng nhập để bước vào hội.');
          }
        } else {
          showToast('Đã ghi danh. Vui lòng đăng nhập để bước vào hội.');
        }
        setModal(null);
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw new Error(result.error.message);
        if (!result.data.user) throw new Error('Không thể đăng nhập.');
        const profile = await ensureProfile();
        if (!profile) throw new Error('Không tìm thấy hồ sơ. Vui lòng liên hệ quản trị viên.');
        setUser(profile);
        showToast('Hoan nghênh quý nhân trở lại.');
        setModal(null);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Thông tin chưa hợp lệ hoặc hồ sơ chưa sẵn sàng. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const releaseLantern = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setModal('auth');
      setAuthMode('login');
      return;
    }
    const form = new FormData(event.currentTarget);
    const senderName = String(form.get('senderName') ?? '').trim();
    const wish = String(form.get('wish') ?? '').trim();
    const styleIndex = (user.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 280) + 1;
    const nextLantern = { user_id: user.id, style_index: styleIndex, sender_name: senderName, wish, recipient_name: null };
    setReleasedLantern({ name: senderName, wish });
    setModal(null);
    setReleaseAnimation(true);
    const result = await supabase.from('lanterns').insert(nextLantern).select('id, style_index, sender_name, wish, recipient_name').maybeSingle();
    if (result.error || !result.data) {
      showToast('Hoa đăng chưa lưu được — nhưng lời nguyện đã bay lên trời.');
    } else {
      setLanterns((current) => [result.data as LanternData, ...current]);
    }
    if (!soundOn) { setSoundOn(true); audioRef.current = getAudioContext(); startAmbientMusic(); }
    playChime(440, 0.1);
    setTimeout(() => playChime(659.25, 0.08), 200);
    const readTime = Math.min(40000, Math.max(10000, wish.length * 100));
    fireworkTimersRef.current.push(window.setTimeout(() => {
      setReleaseAnimation(false);
      setReleasedLantern(null);
      showToast('Hoa đăng đã khởi hành. Mong chúc nguyện của quý nhân sẽ đạt thành.');
    }, 13500 + readTime));
  };

  const handleCreateGift = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setModal('auth');
      setAuthMode('login');
      return;
    }
    const form = new FormData(event.currentTarget);
    const senderName = String(form.get('giftSenderName') ?? '').trim();
    const recipientName = String(form.get('giftRecipientName') ?? '').trim();
    const wish = String(form.get('giftWish') ?? '').trim();
    const password = String(form.get('giftPassword') ?? '').trim();
    if (!senderName || !wish || password.length < 4) {
      showToast('Vui lòng điền đầy đủ. Mật khẩu tối thiểu 4 ký tự.');
      return;
    }
    const styleIndex = (user.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 280) + 1;
    setIsSubmitting(true);
    const result = await createGreetingCard(senderName, recipientName || null, wish, password, styleIndex);
    setIsSubmitting(false);
    if (!result) {
      showToast('Không thể tạo thiệp. Vui lòng thử lại.');
      return;
    }
    const viewUrl = `${window.location.origin}${window.location.pathname}#/view/${result.out_token}`;
    try {
      const qr = await QRCode.toDataURL(viewUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#2c090b', light: '#f2d18a' },
      });
      setQrDataUrl(qr);
    } catch {
      setQrDataUrl(null);
    }
    setGiftResult({ token: result.out_token, senderName, recipientName, wish });
    setModal('giftSuccess');
  };

  const updateOwnProfile = async (fields: Partial<Pick<Profile, 'oc_name' | 'avatar_url' | 'wish' | 'quote'>>) => {
    if (!user) return;
    const params: Record<string, string | null> = {};
    if (fields.oc_name !== undefined) params.p_oc_name = fields.oc_name;
    if (fields.avatar_url !== undefined) params.p_avatar_url = fields.avatar_url;
    if (fields.wish !== undefined) params.p_wish = fields.wish;
    if (fields.quote !== undefined) params.p_quote = fields.quote;
    const { data, error } = await supabase.rpc('update_my_profile', params);
    if (error || !data || data.length === 0) {
      console.error('update_my_profile failed:', error?.message, error?.code, error?.details);
      showToast('Không thể cập nhật. Vui lòng thử lại.');
      return;
    }
    setUser(data[0] as Profile);
    showToast('Đã cập nhật hồ sơ.');
  };

  const loadMemories = async () => {
    setMemoriesLoading(true);
    const { data, error } = await supabase.rpc('get_my_memories');
    if (error || !data) {
      setMemories([]);
    } else {
      setMemories(data as Memory[]);
    }
    setMemoriesLoading(false);
  };

  const replayMemory = (memory: Memory) => {
    setReleasedLantern({ name: memory.sender_name, wish: memory.wish });
    setModal(null);
    setReleaseAnimation(true);
    if (!soundOn) { setSoundOn(true); audioRef.current = getAudioContext(); startAmbientMusic(); }
    playChime(440, 0.1);
    setTimeout(() => playChime(659.25, 0.08), 200);
    const readTime = Math.min(40000, Math.max(10000, memory.wish.length * 100));
    fireworkTimersRef.current.push(window.setTimeout(() => {
      setReleaseAnimation(false);
      setReleasedLantern(null);
    }, 13500 + readTime));
  };

  // Greeting view (recipient entered via QR link)
  if (greetingToken) {
    return <GreetingView token={greetingToken} />;
  }

  if (showAdmin && user?.is_admin) {
    return <AdminPanel onClose={() => setShowAdmin(false)} />;
  }

  // Full-screen release animation — spectacular night sky with rising lotus
  if (releaseAnimation) {
    const skyStars = Array.from({ length: 200 }, (_, i) => ({
      id: i,
      left: `${(i * 37 + 3) % 100}%`,
      top: `${(i * 19) % 85}%`,
      delay: `${(i % 9) * 0.5}s`,
      size: i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1,
      twinkle: i % 4,
    }));
    return (
      <main className="festival-shell release-sky" style={{ minHeight: '100vh', overflow: 'hidden', position: 'relative', display: 'grid', placeItems: 'center' }}>
        <div className="release-nebula" aria-hidden="true" />
        <div className="release-milkyway" aria-hidden="true" />
        <div className="stars release-stars" aria-hidden="true">
          {skyStars.map((s) => <i key={s.id} className={`twinkle-${s.twinkle}`} style={{ left: s.left, top: s.top, animationDelay: s.delay, width: s.size, height: s.size }} />)}
        </div>
        <div className="moon release-moon" aria-hidden="true"><span /></div>
        <div className="release-mountains" aria-hidden="true" />
        <div className="release-ground-glow" aria-hidden="true" />
        <div className="personal-lantern-rise" aria-hidden="true">
          <div className="release-lotus-trail" />
          <div className="release-lotus-scale">
            <div className="lantern-lotus-body">
              <div className="lantern-core" />
              <div className="lantern-petal lp-outer lp-out-l3" />
              <div className="lantern-petal lp-outer lp-out-l2" />
              <div className="lantern-petal lp-outer lp-out-l1" />
              <div className="lantern-petal lp-outer lp-out-mid" />
              <div className="lantern-petal lp-outer lp-out-r1" />
              <div className="lantern-petal lp-outer lp-out-r2" />
              <div className="lantern-petal lp-outer lp-out-r3" />
              <div className="lantern-petal lp-mid lp-mid-l2" />
              <div className="lantern-petal lp-mid lp-mid-l1" />
              <div className="lantern-petal lp-mid lp-mid-r1" />
              <div className="lantern-petal lp-mid lp-mid-r2" />
              <div className="lantern-petal lp-inner lp-in-l" />
              <div className="lantern-petal lp-inner lp-in-mid" />
              <div className="lantern-petal lp-inner lp-in-r" />
              <div className="lantern-petal lp-bottom lp-bot-l" />
              <div className="lantern-petal lp-bottom lp-bot-m" />
              <div className="lantern-petal lp-bottom lp-bot-r" />
            </div>
            <div className="lantern-calyx-base">
              <div className="calyx-ruby-inlay" />
              <div className="calyx-hooks-row">
                <div className="gold-hook" /><div className="gold-hook" /><div className="gold-hook" />
              </div>
            </div>
            <div className="pearl-cascades-container">
              <div className="bead-string string-side-left">
                <div className="bead-gold" /><div className="gold-thread-link" /><div className="bead-pearl small" /><div className="gold-thread-link" /><div className="bead-pearl small" /><div className="gold-thread-link" /><div className="ruby-teardrop small" />
              </div>
              <div className="bead-string string-center">
                <div className="bead-gold" /><div className="gold-thread-link" /><div className="bead-pearl" /><div className="gold-thread-link" /><div className="bead-gold" /><div className="gold-thread-link" /><div className="bead-pearl" /><div className="gold-thread-link" /><div className="ruby-teardrop" />
              </div>
              <div className="bead-string string-side-right">
                <div className="bead-gold" /><div className="gold-thread-link" /><div className="bead-pearl small" /><div className="gold-thread-link" /><div className="bead-pearl small" /><div className="gold-thread-link" /><div className="ruby-teardrop small" />
              </div>
            </div>
          </div>
          {releasedLantern && <div className="personal-lantern-label">{releasedLantern.name}</div>}
        </div>
        {releasedLantern && (
          <div className="release-wish-overlay">
            <div className="release-wish-frame" />
            <p>“{releasedLantern.wish}”</p>
            <small>Mong chúc nguyện của quý nhân sẽ đạt thành.</small>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="festival-shell" onClick={() => { if (!soundOn) makeSound(); }}>
      <div className="mist mist-one" /><div className="mist mist-two" />
      <div className="stars" aria-hidden="true">{stars.map((star) => <i key={star.id} style={{ left: star.left, top: star.top, animationDelay: star.delay, width: star.size, height: star.size }} />)}</div>
      <div className="moon"><span /></div>
      <div className="mountains mountain-back" /><div className="mountains mountain-front" />
      <div className="floating-lanterns" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <div className={`sky-lantern lantern-${index + 1}`} key={index}><span /><b /></div>)}
      </div>

      <header className="topbar">
        <div className="brand-mark"><span className="brand-seal">重</span><div><strong>TRÙNG HOAN TÁI</strong><small>CHÚC ĐĂNG HỘI · ĐÊM NGUYỆN ƯỚC</small></div></div>
        <nav aria-label="Điều hướng chính" className={navOpen ? 'nav-open' : ''}><a href="#home" onClick={() => setNavOpen(false)}>Tịnh cảnh</a><a href="#lanterns" onClick={() => setNavOpen(false)}>Tinh đăng</a><a href="#ritual" onClick={() => setNavOpen(false)}>Lễ nghi</a></nav>
        <div className="top-actions">
          <button className="icon-button" aria-label={soundOn ? 'Tắt âm thanh lễ hội' : 'Bật âm thanh lễ hội'} aria-pressed={soundOn} onClick={(event) => { event.stopPropagation(); makeSound(); }}><Music2 size={16} aria-hidden="true" /><span>{soundOn ? 'Đang ngân' : 'Chạm để nghe'}</span></button>
          {user?.is_admin && (
            <button className="admin-pill" onClick={(event) => { event.stopPropagation(); setShowAdmin(true); }} aria-label="Bản quản trị">
              <Shield size={15} aria-hidden="true" /> <span>Quản trị</span>
            </button>
          )}
          {user ? (
            <button className="profile-pill" onClick={(event) => { event.stopPropagation(); setModal('profile'); }}>
              {user.avatar_url ? <img src={user.avatar_url} alt="" className="nav-avatar" /> : <CircleUserRound size={17} aria-hidden="true" />}
              <span className="profile-pill-name">{user.oc_name}</span>

            </button>
          ) : (
            <button className="ghost-button" onClick={(event) => { event.stopPropagation(); setModal('auth'); setAuthMode('login'); }}><LogIn size={16} aria-hidden="true" /> <span className="btn-label">Đăng nhập</span></button>
          )}
          <button className="nav-toggle" aria-label="Mở menu" aria-expanded={navOpen} onClick={(event) => { event.stopPropagation(); setNavOpen(!navOpen); }}>
            {navOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy"><div className="eyebrow"><span aria-hidden="true" /> Đêm rằm tháng bảy · Hải đường phủ <span aria-hidden="true" /></div><h1>TRÙNG<br /><em>HOAN</em> TÁI</h1><div className="title-rule"><span aria-hidden="true" /><span className="diamond" aria-hidden="true">◇</span><span aria-hidden="true" /></div><p>CHÚC ĐĂNG HỘI</p><small className="hero-subtitle">Một lời nguyện thành tâm, gửi theo ánh lửa<br />vượt qua muôn trùng mây nước.</small><div className="hero-actions"><button className="primary-button" onClick={(event) => { event.stopPropagation(); setModal('lantern'); setLanternMode(null); }}><Flame size={17} aria-hidden="true" /> Thả hoa đăng <ArrowRight size={17} aria-hidden="true" /></button><button className="text-button" onClick={(event) => { event.stopPropagation(); document.querySelector('#ritual')?.scrollIntoView({ behavior: 'smooth' }); }}>Khám phá nghi lễ <ArrowDown size={15} aria-hidden="true" /></button></div></div>
        <div className="hero-ornament"><div className="vertical-scroll"><span>愿</span><span>灯</span><span>会</span><span>成</span></div><div className="seal-stamp">福<br /><small>TRÙNG</small></div></div>
      </section>

      <section className="lantern-showcase" id="lanterns"><div className="section-heading"><div><span className="section-kicker">01 · THIÊN ĐĂNG LỘ</span><h2>Những lời nguyện<br /><em>đang bay lên</em></h2></div><p>Mỗi hoa đăng là một dấu ấn độc bản.<br />Mỗi ánh lửa là một lời mong cầu.</p></div><div className="lantern-track">{seedLanterns.slice(0, 3).map((lantern, index) => <article className={`lantern-card card-${index + 1}`} key={lantern.id}><div className="card-glow" aria-hidden="true" /><div className="lotus-lantern" aria-hidden="true"><div className="petals petals-back" /><div className="petals petals-front" /><div className="lantern-flame" /></div><div className="card-meta"><span>ĐĂNG · {String(lantern.style_index).padStart(3, '0')}</span><strong>{lantern.sender_name}</strong><p>"{lantern.wish}"</p></div></article>)}</div><div className="track-footer"><span><Sparkles size={14} aria-hidden="true" /> {lanterns.length + 268} ngọn đèn đang hiện hữu</span><button onClick={(event) => { event.stopPropagation(); setModal('lanternGift'); }}>Gửi đến người thân thương <ArrowRight size={15} aria-hidden="true" /></button></div></section>

      <section className="ritual-section" id="ritual"><div className="ritual-art" aria-hidden="true"><div className="large-lantern"><div className="lantern-crown">✦</div><div className="large-petals" /><div className="large-flame" /></div><div className="orbit orbit-one" /><div className="orbit orbit-two" /></div><div className="ritual-copy"><span className="section-kicker">02 · TÂM NGUYỆN</span><h2>Gửi một lời,<br /><em>giữ một đời.</em></h2><p>Chọn một kiểu hoa đăng dành riêng cho quý nhân. Viết lời nguyện thầm kín, rồi thả ánh lửa lên trời — nơi vầng trăng sẽ thay người giữ hộ.</p><div className="ritual-list"><div><b aria-hidden="true">一</b><span><strong>Chọn hoa đăng</strong><small>Nơi lưu tấm lòng, vô vàn quý giá.</small></span></div><div><b aria-hidden="true">二</b><span><strong>Gửi lời chúc</strong><small>Trao điều ước đến người thân thương</small></span></div><div><b aria-hidden="true">三</b><span><strong>Thả lên trời</strong><small>Vầng trăng sẽ thay người giữ hộ</small></span></div></div><div className="ritual-choice-buttons">
        <button className="primary-button" onClick={(event) => { event.stopPropagation(); setModal('lantern'); setLanternMode('personal'); }}><Flame size={16} aria-hidden="true" /> Đăng hỏa cá nhân <ArrowRight size={15} aria-hidden="true" /></button>
        <button className="outline-button" onClick={(event) => { event.stopPropagation(); setModal('lanternGift'); setLanternMode('gift'); }}><Gem size={16} aria-hidden="true" /> Gửi người thân thương <ArrowRight size={15} aria-hidden="true" /></button>
      </div></div></section>

      <footer><div className="footer-brand"><span className="brand-seal">福</span><span>TRÙNG HOAN TÁI</span></div><span>Chúc đăng hội · Nguyện hữu tình nhân</span><span>© 2026 · Đêm nay, nguyện ước không ngủ</span></footer>

      {toast && <div className="toast" role="status" aria-live="polite"><Check size={16} aria-hidden="true" /> {toast}</div>}

      {modal === 'auth' && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="modal-panel auth-panel" role="dialog" aria-modal="true" aria-label={authMode === 'login' ? 'Đăng nhập' : 'Ghi danh'} onClick={(event) => event.stopPropagation()}><button className="close-button" aria-label="Đóng cửa sổ" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button><span className="section-kicker">TRÙNG HOAN TÁI · GIAO ƯỚC</span><h2>{authMode === 'login' ? 'Trở về tịnh cảnh' : 'Ghi danh vào hội'}</h2><p className="modal-intro">{authMode === 'login' ? 'Đăng nhập để tìm lại hoa đăng của quý nhân.' : 'Ghi danh để nhận một đóa hoa sen độc bản và bước vào hội.'}</p><form onSubmit={handleAuth}>{authMode === 'signup' && <label>Tên OC<input name="name" placeholder="Tên nhân vật của quý nhân…" autoComplete="off" spellCheck={false} required /></label>}<label>Email<input name="email" type="email" placeholder="thuvien@trunghoantai.vn" autoComplete="email" spellCheck={false} required /></label><label>Mật khẩu<input name="password" type="password" placeholder="Tối thiểu 6 ký tự…" minLength={6} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required /></label>{authError && <div className="form-error" role="alert">{authError}</div>}<button className="primary-button full-button" disabled={isSubmitting}>{isSubmitting ? 'Đang mở cánh cửa…' : authMode === 'login' ? 'Đăng nhập' : 'Gửi hồ sơ ghi danh'} <ArrowRight size={16} aria-hidden="true" /></button></form><button className="switch-button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}>{authMode === 'login' ? 'Chưa có hồ sơ? Ghi danh ngay' : 'Đã có hồ sơ? Đăng nhập'}</button></div></div>}

      {modal === 'lantern' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-panel lantern-panel" role="dialog" aria-modal="true" aria-label="Đăng hỏa cá nhân" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" aria-label="Đóng cửa sổ" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button>
            <span className="section-kicker">CỬA HÀNG ĐĂNG HỎA · {user ? `ĐĂNG RIÊNG CỦA ${user.oc_name.toUpperCase()}` : 'MỜI GHI DANH'}</span>
            <h2>Thả một đóa <em>tâm đăng</em></h2>
            <p className="modal-intro">Đăng hỏa cá nhân — đèn của quý nhân sẽ mang tên quý nhân, bay lên bầu trời lễ hội dưới ánh trăng.</p>
            {user ? (
              <form onSubmit={releaseLantern}>
                <label>Tên viết trên đèn<input name="senderName" defaultValue={user.oc_name} autoComplete="off" spellCheck={false} required /></label>
                <label>Lời chúc gửi theo gió<textarea name="wish" defaultValue={user.wish} maxLength={500} placeholder="Viết lời nguyện của quý nhân…" required /></label>
                <div className="style-note"><Flower2 size={19} aria-hidden="true" /><span><strong>Hoa sen kiểu {lanternNames[(user.id.length + 3) % lanternNames.length]}</strong><small>Độc bản dành riêng cho tài khoản này · Mẫu số {(user.id.length * 7) % 280 + 1}/280</small></span></div>
                <button className="primary-button full-button">Thả đèn lên trời <Flame size={16} aria-hidden="true" /></button>
              </form>
            ) : (
              <div className="empty-auth" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '26px 0 8px' }}><Crown size={32} aria-hidden="true" /><p style={{ margin: 0, maxWidth: 320, lineHeight: 1.7 }}>Quý nhân hãy ghi danh hoặc đăng nhập để nhận một đóa hoa sen độc bản.</p><button className="primary-button" style={{ marginTop: 2 }} onClick={() => { setModal('auth'); setAuthMode('signup'); }}>Ghi danh ngay <ArrowRight size={16} aria-hidden="true" /></button></div>
            )}
            <button className="switch-button" onClick={() => setModal('lanternGift')}>Muốn gửi đến người thân thương? Tạo thiệp tâm đăng</button>
          </div>
        </div>
      )}

      {modal === 'lanternGift' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-panel receiver-panel" role="dialog" aria-modal="true" aria-label="Tạo thiệp tâm đăng" onClick={(event) => event.stopPropagation()} style={{ paddingTop: 38, paddingBottom: 30 }}>
            <button className="close-button" aria-label="Đóng cửa sổ" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button>
            <Gem size={27} className="modal-gem" aria-hidden="true" />
            <span className="section-kicker">THIỆP TÂM ĐĂNG · GỬI NGƯỜI THƯƠNG</span>
            <h2>Một lời chúc<br /><em>đợi người mở khóa</em></h2>
            <p className="modal-intro">Tạo thiệp với mã QR riêng. Người nhận quét mã, nhập mật khẩu — sẽ xem được lời chúc và màn thả đèn trên bầu trời.</p>
            {user ? (
              <form onSubmit={handleCreateGift}>
                <label>Tên người gửi<input name="giftSenderName" defaultValue={user.oc_name} autoComplete="off" spellCheck={false} required /></label>
                <label>Tên người nhận<input name="giftRecipientName" placeholder="Tên người nhận thiệp…" autoComplete="off" spellCheck={false} /></label>
                <label>Nội dung lời chúc<textarea name="giftWish" maxLength={500} placeholder="Lời chúc muốn gửi…" required /></label>
                <label>Mật khẩu người nhận<input name="giftPassword" type="password" placeholder="Tạo mật khẩu thiệp (tối thiểu 4 ký tự)…" minLength={4} autoComplete="new-password" required /></label>
                <button className="primary-button full-button" disabled={isSubmitting}>{isSubmitting ? 'Đang tạo thiệp…' : 'Tạo thiệp tâm đăng'} <ArrowRight size={16} aria-hidden="true" /></button>
              </form>
            ) : (
              <div className="empty-auth" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '26px 0 8px' }}><Crown size={32} aria-hidden="true" /><p style={{ margin: 0, maxWidth: 300, lineHeight: 1.7 }}>Quý nhân hãy ghi danh để tạo thiệp tâm đăng.</p><button className="primary-button" style={{ marginTop: 2 }} onClick={() => { setModal('auth'); setAuthMode('signup'); }}>Ghi danh ngay <ArrowRight size={16} aria-hidden="true" /></button></div>
            )}
            <button className="switch-button" onClick={() => setModal('lantern')}>Muốn thả đèn cá nhân? Đăng hỏa riêng</button>
          </div>
        </div>
      )}

      {modal === 'giftSuccess' && giftResult && (
        <div className="modal-backdrop" onClick={() => { setModal(null); setGiftResult(null); setQrDataUrl(null); }}>
          <div className="modal-panel gift-success-panel" role="dialog" aria-modal="true" aria-label="Thiệp tâm đăng đã tạo" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" aria-label="Đóng" onClick={() => { setModal(null); setGiftResult(null); setQrDataUrl(null); }}><X size={18} aria-hidden="true" /></button>
            <Check size={32} style={{ color: '#7bc97b', margin: '0 auto 12px', display: 'block' }} aria-hidden="true" />
            <span className="section-kicker" style={{ display: 'block', textAlign: 'center' }}>THIỆP ĐÃ TẠO</span>
            <h2 style={{ textAlign: 'center' }}>Lưu mã QR<br /><em>gửi người thương</em></h2>
            <p className="modal-intro" style={{ textAlign: 'center' }}>Quý nhân lưu mã QR bên dưới, gửi cho người nhận. Người nhận quét mã rồi nhập mật khẩu để mở thiệp.</p>
            {qrDataUrl && (
              <div className="qr-display">
                <img src={qrDataUrl} alt="Mã QR thiệp tâm đăng" />
              </div>
            )}
            <div className="gift-link-box">
              <label>Link thiệp<input readOnly value={`${window.location.origin}${window.location.pathname}#/view/${giftResult.token}`} onFocus={(e) => e.currentTarget.select()} /></label>
            </div>
            <button className="primary-button full-button" onClick={() => { setModal(null); setGiftResult(null); setQrDataUrl(null); showToast('Thiệp tâm đăng đã sẵn sàng.'); }}>Xong <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
      )}

      {modal === 'profile' && user && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-panel profile-panel" role="dialog" aria-modal="true" aria-label="Hồ sơ quý nhân" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" aria-label="Đóng cửa sổ" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button>
            <div className="profile-avatar-wrap" onClick={() => setModal('editAvatar')}>
              {user.avatar_url ? <img src={user.avatar_url} alt="" className="profile-avatar-img" /> : <CircleUserRound size={48} aria-hidden="true" />}
              <span className="avatar-edit-hint">Đổi ảnh</span>
            </div>
            <span className="section-kicker">HỒ SƠ QUÝ NHÂN</span>
            <h2>{user.oc_name}</h2>
            <div className="profile-email-row">
              <span className="profile-email">{emailVisible ? user.email : '••••••••'}</span>
              <button className="email-toggle-btn" onClick={(event) => { event.stopPropagation(); setEmailVisible(!emailVisible); }} aria-label={emailVisible ? 'Ẩn email' : 'Hiện email'}>
                {emailVisible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              </button>
            </div>
            <div className="profile-sections">
              <div className="profile-field">
                <span className="field-label">Danh tính</span>
                <div className="field-value">{user.oc_name}</div>
              </div>
              <div className="profile-field">
                <span className="field-label">Trích dẫn</span>
                <div className="field-value quote-field">"{user.quote}"<button className="field-edit-btn" onClick={() => setModal('editQuote')}><Star size={12} aria-hidden="true" /> Sửa</button></div>
              </div>
              <div className="profile-field">
                <span className="field-label">Chúc nguyện</span>
                <div className="field-value wish-field">"{user.wish}"<button className="field-edit-btn" onClick={() => setModal('editWish')}><Star size={12} aria-hidden="true" /> Sửa</button></div>
              </div>
            </div>
            <div className="profile-actions">
              <button className="outline-button" onClick={() => { loadMemories(); setModal('memories'); setMemoriesTab('lantern'); }}><BookOpen size={16} aria-hidden="true" /> Kỷ Niệm</button>
              <button className="outline-button" onClick={() => setModal('lantern')}>Cửa hàng đăng hỏa</button>
              <button className="text-button" onClick={async () => { await supabase.auth.signOut(); setUser(null); setModal(null); }}>Rời khỏi hội</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'editAvatar' && user && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Đổi ảnh đại diện" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" aria-label="Đóng" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button>
            <span className="section-kicker">ĐỔI ẢNH ĐẠI DIỆN</span>
            <h2>Ảnh đại diện</h2>
            <p className="modal-intro">Dán link ảnh của quý nhân vào ô dưới. Ảnh sẽ hiện trên hồ sơ và góc điều hướng.</p>
            <form onSubmit={async (e) => { e.preventDefault(); const form = new FormData(e.currentTarget); const url = String(form.get('avatarUrl') ?? '').trim(); await updateOwnProfile({ avatar_url: url || null }); setModal('profile'); }}>
              <label>Link ảnh<input name="avatarUrl" defaultValue={user.avatar_url ?? ''} placeholder="https://…" autoComplete="off" spellCheck={false} /></label>
              <button className="primary-button full-button">Lưu ảnh <ArrowRight size={16} aria-hidden="true" /></button>
            </form>
          </div>
        </div>
      )}

      {modal === 'editQuote' && user && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Sửa trích dẫn" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" aria-label="Đóng" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button>
            <span className="section-kicker">TRÍCH DẪN</span>
            <h2>Trích dẫn</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const form = new FormData(e.currentTarget); const q = String(form.get('quote') ?? '').trim(); await updateOwnProfile({ quote: q }); setModal('profile'); }}>
              <label>Nội dung trích dẫn<textarea name="quote" defaultValue={user.quote} maxLength={300} required /></label>
              <button className="primary-button full-button">Lưu trích dẫn <ArrowRight size={16} aria-hidden="true" /></button>
            </form>
          </div>
        </div>
      )}

      {modal === 'editWish' && user && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Sửa chúc nguyện" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" aria-label="Đóng" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button>
            <span className="section-kicker">CHÚC NGUYỆN</span>
            <h2>Chúc nguyện</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const form = new FormData(e.currentTarget); const w = String(form.get('wish') ?? '').trim(); await updateOwnProfile({ wish: w }); setModal('profile'); }}>
              <label>Lời chúc nguyện<textarea name="wish" defaultValue={user.wish} maxLength={500} required /></label>
              <button className="primary-button full-button">Lưu chúc nguyện <ArrowRight size={16} aria-hidden="true" /></button>
            </form>
          </div>
        </div>
      )}

      {modal === 'memories' && user && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-panel memories-panel" role="dialog" aria-modal="true" aria-label="Kỷ niệm của quý nhân" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" aria-label="Đóng" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button>
            <BookOpen size={28} style={{ color: '#e8bc67', margin: '0 auto 10px', display: 'block' }} aria-hidden="true" />
            <span className="section-kicker" style={{ display: 'block', textAlign: 'center' }}>KỶ NIỆM · {user.oc_name.toUpperCase()}</span>
            <h2 style={{ textAlign: 'center' }}>Sổ tay<br /><em>hoa đăng</em></h2>
            <p className="modal-intro" style={{ textAlign: 'center' }}>Mỗi đóa đèn quý nhân đã thả — cho mình hay cho người thương — đều lưu nơi đây. Chạm vào một kỷ niệm để xem lại màn thả đèn.</p>
            <div className="memories-tabs">
              <button className={memoriesTab === 'lantern' ? 'active' : ''} onClick={() => setMemoriesTab('lantern')}><Flame size={14} aria-hidden="true" /> Đăng hỏa cá nhân</button>
              <button className={memoriesTab === 'gift' ? 'active' : ''} onClick={() => setMemoriesTab('gift')}><Gift size={14} aria-hidden="true" /> Thiệp tâm đăng</button>
            </div>
            <div className="memories-list">
              {memoriesLoading ? (
                <div className="memories-empty">Đang mở sổ tay…</div>
              ) : memories.filter((m) => m.type === memoriesTab).length === 0 ? (
                <div className="memories-empty">
                  {memoriesTab === 'lantern' ? 'Chưa có đăng hỏa cá nhân nào.' : 'Chưa có thiệp tâm đăng nào.'}
                  <br />Hãy thả một đóa đèn để bắt đầu kỷ niệm.
                </div>
              ) : (
                memories.filter((m) => m.type === memoriesTab).map((m) => (
                  <div key={m.id} className="memory-card" onClick={() => replayMemory(m)}>
                    <div className="memory-card-glow" aria-hidden="true" />
                    <div className="memory-lantern-icon" aria-hidden="true">
                      <div className="memory-petals" />
                      <div className="memory-flame" />
                    </div>
                    <div className="memory-content">
                      <span className="memory-style">ĐĂNG · {String(m.style_index).padStart(3, '0')}</span>
                      <strong>{m.sender_name}{m.recipient_name ? ` → ${m.recipient_name}` : ''}</strong>
                      <p>"{m.wish}"</p>
                      <small>{new Date(m.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}</small>
                    </div>
                    <div className="memory-replay-hint"><Sparkles size={14} aria-hidden="true" /> Xem lại</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
