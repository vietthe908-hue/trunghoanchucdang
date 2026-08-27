import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Lock, X } from 'lucide-react';
import { verifyGreetingCard } from '@/lib/greeting';
import type { VerifiedCard } from '@/lib/greeting';
import { getAudioContext, playCrescendo, startAmbientMusic, startFireworkLoop, stopFireworkLoop, stopAmbientMusic } from '@/lib/audio';

export default function GreetingView({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [card, setCard] = useState<VerifiedCard | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const soundLoopRef = useRef<number | null>(null);
  const [soundStarted, setSoundStarted] = useState(false);

  const stars = useMemo(
    () =>
      Array.from({ length: 100 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        top: `${(i * 19) % 80}%`,
        delay: `${(i % 7) * 0.7}s`,
        size: i % 5 === 0 ? 3 : 2,
      })),
    [],
  );

  const embers = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: `${(i * 11 + 5) % 100}%`,
        bottom: `${(i * 7) % 50}%`,
        delay: `${(i % 6) * 0.9}s`,
      })),
    [],
  );

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setError('');
    const result = await verifyGreetingCard(token, password.trim());
    setSubmitting(false);
    if (!result || !result.verified) {
      setError('Mật khẩu không đúng. Vui lòng thử lại.');
      return;
    }
    setCard(result);
    setUnlocked(true);
    audioRef.current = getAudioContext();
    playCrescendo();
    startAmbientMusic();
    setSoundStarted(true);
    setTimeout(() => startFireworkLoop(1000), 800);
  };

  useEffect(() => {
    if (unlocked) {
      return () => {
        stopFireworkLoop();
        stopAmbientMusic();
      };
    }
  }, [unlocked]);

  if (!unlocked) {
    return (
      <main className="festival-shell greeting-locked" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="stars greeting-stars" aria-hidden="true">
          {stars.map((s) => (
            <i key={s.id} style={{ left: s.left, top: s.top, animationDelay: s.delay, width: s.size, height: s.size }} />
          ))}
        </div>
        <div className="greeting-moon-bg" aria-hidden="true" />
        <div className="greeting-lock-panel" role="dialog" aria-modal="true" aria-label="Mở khóa thiệp">
          <Lock size={28} style={{ color: '#e4b967', margin: '0 auto 12px', display: 'block' }} aria-hidden="true" />
          <span className="greeting-kicker">THIỆP LỜI CHÚC</span>
          <h2 className="greeting-lock-title">Mở khóa<br /><em>lời chúc</em></h2>
          <p className="greeting-lock-intro">
            Có người đã gửi quý nhân một lời chúc thầm kín.<br />
            Nhập mật khẩu để mở thiệp và ngắm hoa đăng trên bầu trời.
          </p>
          <form onSubmit={handleUnlock}>
            <label className="greeting-lock-label">
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu…"
                autoComplete="off"
                autoFocus
                required
              />
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button full-button" disabled={submitting}>
              {submitting ? 'Đang mở khóa…' : 'Mở thiệp'} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      </main>
    );
  }

  const recipient = card!.recipient_name || 'Quý nhân';

  return (
    <main className="festival-shell greeting-sky" style={{ minHeight: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Stars */}
      <div className="stars greeting-stars" aria-hidden="true">
        {stars.map((s) => (
          <i key={s.id} style={{ left: s.left, top: s.top, animationDelay: s.delay, width: s.size, height: s.size }} />
        ))}
      </div>

      {/* Floating embers */}
      {embers.map((em) => (
        <div key={em.id} className="light-ember" style={{ left: em.left, bottom: em.bottom, animationDelay: em.delay }} aria-hidden="true" />
      ))}

      {/* Decorative moon — smaller than the lotus lantern */}
      <div className="greeting-moon" aria-hidden="true" />

      {/* Animated water background — two images with ripple effect */}
      <div className="greeting-water-bg" aria-hidden="true">
        <div className="greeting-water-layer greeting-water-layer-back" />
        <div className="greeting-water-layer greeting-water-layer-front" />
        <div className="greeting-water-ripple" />
      </div>

      {/* Giant red-gold lotus lantern with pearl cascades — centered floating unit */}
      <div className="greeting-lantern-unit" aria-hidden="true">
        {/* Gold dust particles */}
        <div className="lantern-gold-dust d1" />
        <div className="lantern-gold-dust d2" />
        <div className="lantern-gold-dust d3" />
        <div className="lantern-gold-dust d4" />

        {/* 1. Giant lotus body */}
        <div className="lantern-lotus-body">
          <div className="lantern-core" />
          {/* Outer petals */}
          <div className="lantern-petal lp-outer lp-out-l3" />
          <div className="lantern-petal lp-outer lp-out-l2" />
          <div className="lantern-petal lp-outer lp-out-l1" />
          <div className="lantern-petal lp-outer lp-out-mid" />
          <div className="lantern-petal lp-outer lp-out-r1" />
          <div className="lantern-petal lp-outer lp-out-r2" />
          <div className="lantern-petal lp-outer lp-out-r3" />
          {/* Mid petals */}
          <div className="lantern-petal lp-mid lp-mid-l2" />
          <div className="lantern-petal lp-mid lp-mid-l1" />
          <div className="lantern-petal lp-mid lp-mid-r1" />
          <div className="lantern-petal lp-mid lp-mid-r2" />
          {/* Inner petals */}
          <div className="lantern-petal lp-inner lp-in-l" />
          <div className="lantern-petal lp-inner lp-in-mid" />
          <div className="lantern-petal lp-inner lp-in-r" />
          {/* Bottom petals */}
          <div className="lantern-petal lp-bottom lp-bot-l" />
          <div className="lantern-petal lp-bottom lp-bot-m" />
          <div className="lantern-petal lp-bottom lp-bot-r" />
        </div>

        {/* 2. Golden calyx base — hugs the petal stems */}
        <div className="lantern-calyx-base">
          <div className="calyx-ruby-inlay" />
          <div className="calyx-hooks-row">
            <div className="gold-hook" />
            <div className="gold-hook" />
            <div className="gold-hook" />
          </div>
        </div>

        {/* 3. Pearl cascades hanging from 3 gold hooks */}
        <div className="pearl-cascades-container">
          <div className="bead-string string-side-left">
            <div className="bead-gold" />
            <div className="gold-thread-link" />
            <div className="bead-pearl small" />
            <div className="gold-thread-link" />
            <div className="bead-pearl small" />
            <div className="gold-thread-link" />
            <div className="ruby-teardrop small" />
          </div>
          <div className="bead-string string-center">
            <div className="bead-gold" />
            <div className="gold-thread-link" />
            <div className="bead-pearl" />
            <div className="gold-thread-link" />
            <div className="bead-gold" />
            <div className="gold-thread-link" />
            <div className="bead-pearl" />
            <div className="gold-thread-link" />
            <div className="ruby-teardrop" />
          </div>
          <div className="bead-string string-side-right">
            <div className="bead-gold" />
            <div className="gold-thread-link" />
            <div className="bead-pearl small" />
            <div className="gold-thread-link" />
            <div className="bead-pearl small" />
            <div className="gold-thread-link" />
            <div className="ruby-teardrop small" />
          </div>
        </div>
      </div>

      {/* Fireworks — delicate sparkle pattern */}
      <div className="fireworks-layer" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="firework-sparkle"
            style={{
              left: `${10 + i * 11}%`,
              top: `${12 + (i % 4) * 20}%`,
              animationDelay: `${i * 0.9}s`,
            }}
          >
            {Array.from({ length: 10 }, (_, j) => (
              <span
                key={j}
                className="firework-sparkle-dot"
                style={{ ['--a' as string]: `${j * (360 / 10)}deg` } as React.CSSProperties}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Small square card frame — sender → recipient + preview */}
      {!cardOpen && (
        <button
          className="greeting-card-frame"
          onClick={() => setCardOpen(true)}
          aria-label="Mở thiệp đọc lời chúc"
        >
          <div className="greeting-card-frame-corner greeting-card-frame-corner-tl" aria-hidden="true" />
          <div className="greeting-card-frame-corner greeting-card-frame-corner-tr" aria-hidden="true" />
          <div className="greeting-card-frame-corner greeting-card-frame-corner-bl" aria-hidden="true" />
          <div className="greeting-card-frame-corner greeting-card-frame-corner-br" aria-hidden="true" />
          <div className="greeting-card-frame-header">
            <span className="greeting-card-frame-from">{card!.sender_name}</span>
            <span className="greeting-card-frame-arrow" aria-hidden="true">→</span>
            <span className="greeting-card-frame-to">{recipient}</span>
          </div>
          <span className="greeting-card-frame-hint">Chạm để mở thiệp</span>
        </button>
      )}

      {/* Wish card modal — centered overlay */}
      {cardOpen && (
        <div className="greeting-card-modal-backdrop" onClick={() => setCardOpen(false)}>
          <div className="greeting-wish-card-large" onClick={(e) => e.stopPropagation()}>
            <div className="greeting-wish-card-inner">
              <div className="greeting-wish-frame" aria-hidden="true" />
              <div className="greeting-wish-ornament-top" aria-hidden="true" />
              <span className="greeting-kicker">LỜI CHÚC TỪ TRÁI TIM</span>
              <div className="greeting-wish-sender">{card!.sender_name} gửi đến {recipient}</div>
              <p className="greeting-wish-text-large">"{card!.wish}"</p>
              <div className="greeting-wish-ornament-bottom" aria-hidden="true" />
              <div className="greeting-wish-seal" aria-hidden="true">福</div>
              <button
                className="text-button greeting-close-btn"
                onClick={() => setCardOpen(false)}
              >
                <X size={14} aria-hidden="true" /> Đóng thiệp
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
