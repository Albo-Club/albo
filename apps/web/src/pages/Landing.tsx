import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, FileText, BarChart3, MessageCircle, Mail, ArrowRight, Upload } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import docsendLogo from '@/assets/logos/docsend.svg';
import notionLogo from '@/assets/logos/notion.svg';
import googledriveLogo from '@/assets/logos/googledrive.svg';

const COLORS = {
  cream: '#FAF9F6',
  beige: '#F0EBE3',
  black: '#1a1a1a',
  gray: '#6b6560',
  grayLight: '#a09890',
  white: '#FFFFFF',
  cardShadow: '0 2px 20px rgba(0,0,0,0.06)',
  cardShadowHover: '0 4px 30px rgba(0,0,0,0.10)',
};

const serif = "'Playfair Display', Georgia, serif";
const sans = "'DM Sans', system-ui, sans-serif";

const LOGO_TOKEN = 'pk_2jSBMEBdT4qNSfCGJpMKqA';

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        (e.target as HTMLElement).style.opacity = '1';
        (e.target as HTMLElement).style.transform = 'translateY(0)';
      }
    });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(cb, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cb]);
  return ref;
}

function FadeSection({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className={className} style={{ opacity: 0, transform: 'translateY(28px)', transition: 'opacity 0.7s ease, transform 0.7s ease', ...style }}>
      {children}
    </div>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: COLORS.gray }}>
      {children}
    </span>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: sans, fontSize: 15, color: COLORS.gray, lineHeight: 1.65 }}>
      <Check size={16} style={{ marginTop: 4, flexShrink: 0, color: COLORS.black }} />
      <span>{children}</span>
    </li>
  );
}

function SBadge({ children, bg = '#e8f5e9', color = '#2e7d32' }: { children: string; bg?: string; color?: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: sans, background: bg, color }}>
      {children}
    </span>
  );
}

const LOGO_FALLBACK_COLORS: Record<string, string> = {
  'backmarket.com': '#4caf50',
  'qonto.com': '#1565c0',
  'doctolib.fr': '#7b1fa2',
  'aircall.io': '#0288d1',
  'alan.com': '#2e7d32',
  'pennylane.com': '#f57f17',
  'swile.co': '#e65100',
};

function LogoImg({ domain, alt, size = 32 }: { domain: string; alt?: string; size?: number }) {
  const initial = (alt || domain)?.[0]?.toUpperCase() || '?';
  const fallbackBg = LOGO_FALLBACK_COLORS[domain] || '#6366f1';
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, width: size, height: size }}>
      <img
        src={`https://img.logo.dev/${domain}?token=${LOGO_TOKEN}&size=64&format=png`}
        alt={alt || domain}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'contain', background: '#fff' }}
        loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; const sib = e.currentTarget.nextElementSibling as HTMLElement; if (sib) sib.style.display = 'flex'; }}
      />
      <span style={{ display: 'none', width: size, height: size, borderRadius: '50%', background: fallbackBg, color: 'white', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.44, fontWeight: 700, fontFamily: sans, position: 'absolute', top: 0, left: 0 }}>
        {initial}
      </span>
    </span>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => { if (user) navigate('/portfolio'); }, [user, navigate]);

  const goAuth = () => navigate('/auth');

  return (
    <div style={{ fontFamily: sans, background: COLORS.cream, color: COLORS.black, minHeight: '100vh', overflowX: 'clip' as const }}>

      {/* ─── NAVBAR ─── */}
      <nav style={{
        position: 'sticky' as const, top: 0, zIndex: 100,
        background: 'rgba(250,249,246,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/apple-touch-icon.png" alt="Albo" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 22 }}>Albo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LanguageSwitcher variant="ghost" size="sm" />
            <button onClick={goAuth} style={{ fontFamily: sans, fontSize: 14, fontWeight: 500, color: COLORS.black, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px' }}>
              {t('landing.nav.login')}
            </button>
            <button onClick={goAuth} style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: COLORS.white, background: COLORS.black, border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#333')}
              onMouseLeave={e => (e.currentTarget.style.background = COLORS.black)}
            >
              {t('landing.nav.getStarted')}
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' as const }}>
        <FadeSection>
          <img src="/apple-touch-icon.png" alt="Albo" style={{ width: 72, height: 72, borderRadius: 16, margin: '0 auto 20px' }} />
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: COLORS.grayLight, marginBottom: 28 }}>
            {t('landing.hero.tagline')}
          </p>
          <h1 style={{ fontFamily: serif, fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 700, lineHeight: 1.15, margin: '0 0 24px', color: COLORS.black }}>
            {t('landing.hero.title')}
          </h1>
          <p style={{ fontFamily: sans, fontSize: 'clamp(16px, 2vw, 19px)', lineHeight: 1.7, color: COLORS.gray, maxWidth: 640, margin: '0 auto 36px' }}>
            {t('landing.hero.subtitle')}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <button onClick={goAuth} style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: COLORS.white, background: COLORS.black, border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#333')}
              onMouseLeave={e => (e.currentTarget.style.background = COLORS.black)}
            >
              {t('landing.hero.cta')}
            </button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: COLORS.black, background: 'none', border: `1.5px solid ${COLORS.black}`, borderRadius: 10, padding: '14px 28px', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {t('landing.hero.ctaSecondary')}
            </button>
          </div>
        </FadeSection>

        {/* Hero mock – dealflow table */}
        <FadeSection style={{ marginTop: 56 }}>
          <div style={{ background: COLORS.white, borderRadius: 16, boxShadow: COLORS.cardShadow, overflow: 'hidden', textAlign: 'left' as const }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #eee', fontFamily: sans, fontWeight: 600, fontSize: 14, color: COLORS.gray }}>{t('landing.mock.recentDealflow')}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: sans, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  {[t('landing.mock.company'), t('landing.mock.sector'), t('landing.mock.amount'), t('landing.mock.type')].map(h => (
                    <th key={h} style={{ padding: '10px 24px', textAlign: 'left' as const, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: COLORS.grayLight }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Back Market', domain: 'backmarket.com', sector: 'Recommerce', sColor: '#e8f5e9', sTxt: '#2e7d32', amount: '€350K', type: 'BSA-AIR' },
                  { name: 'Qonto', domain: 'qonto.com', sector: 'FinTech', sColor: '#e3f2fd', sTxt: '#1565c0', amount: '€500K', type: 'Equity' },
                  { name: 'Doctolib', domain: 'doctolib.fr', sector: 'HealthTech', sColor: '#f3e5f5', sTxt: '#7b1fa2', amount: '€200K', type: 'OCA' },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                    <td style={{ padding: '12px 24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LogoImg domain={r.domain} alt={r.name} size={32} />
                      {r.name}
                    </td>
                    <td style={{ padding: '12px 24px' }}><SBadge bg={r.sColor} color={r.sTxt}>{r.sector}</SBadge></td>
                    <td style={{ padding: '12px 24px' }}>{r.amount}</td>
                    <td style={{ padding: '12px 24px', color: COLORS.gray }}>{r.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeSection>
      </section>

      {/* ─── STATS BAND ─── */}
      <FadeSection>
        <section style={{ background: COLORS.beige, padding: '48px 24px', borderTop: '1px solid rgba(0,0,0,0.04)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, textAlign: 'center' as const }}>
            {[
              ['80+', t('landing.stats.projects')],
              ['5M€', t('landing.stats.invested')],
              ['50+', t('landing.stats.companies')],
              ['3 000+', t('landing.stats.emails')],
            ].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: COLORS.black }}>{n}</div>
                <div style={{ fontFamily: sans, fontSize: 13, color: COLORS.gray, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </section>
      </FadeSection>

      {/* ─── SOURCES COMPATIBLES ─── */}
      <FadeSection>
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, textAlign: 'center' as const, marginBottom: 12 }}>
            {t('landing.sources.title')}
          </h2>
          <p style={{ fontFamily: sans, fontSize: 16, color: COLORS.gray, textAlign: 'center' as const, maxWidth: 640, margin: '0 auto 48px' }}>
            {t('landing.sources.subtitle')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {[
              { name: 'DocSend', logo: docsendLogo, fallbackColor: '#4842B7', desc: t('landing.sources.docsend') },
              { name: 'Notion', logo: notionLogo, fallbackColor: '#000000', desc: t('landing.sources.notion') },
              { name: 'Google Drive', logo: googledriveLogo, fallbackColor: '#4285F4', desc: t('landing.sources.gdrive') },
              { name: 'Email', logo: null, fallbackColor: '#6b6560', desc: t('landing.sources.email') },
            ].map((source) => (
              <div key={source.name} style={{ background: COLORS.white, border: '1px solid #e5e2dd', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', textAlign: 'center' as const }}>
                <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  {source.logo ? (
                    <span style={{ position: 'relative', display: 'inline-flex', width: 32, height: 32 }}>
                      <img src={source.logo} alt={source.name} width={32} height={32} style={{ objectFit: 'contain' }} loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; const sib = e.currentTarget.nextElementSibling as HTMLElement; if (sib) sib.style.display = 'flex'; }}
                      />
                      <span style={{ display: 'none', width: 32, height: 32, borderRadius: '50%', background: source.fallbackColor, color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, fontFamily: sans }}>
                        {source.name[0]}
                      </span>
                    </span>
                  ) : (
                    <Mail size={32} style={{ color: COLORS.gray }} />
                  )}
                </div>
                <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: COLORS.black, marginBottom: 6 }}>{source.name}</p>
                <p style={{ fontFamily: sans, fontSize: 13, color: COLORS.gray, lineHeight: 1.6 }}>{source.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: sans, fontSize: 14, color: COLORS.grayLight, textAlign: 'center' as const, maxWidth: 640, margin: '32px auto 0' }}>
            {t('landing.sources.footer')}
          </p>
        </section>
      </FadeSection>

      {/* ─── FEATURES ─── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <div id="features">
        <FeatureRow
          tag={t('landing.features.emailSync.tag')}
          title={t('landing.features.emailSync.title')}
          desc={t('landing.features.emailSync.desc')}
          bullets={t('landing.features.emailSync.bullets', { returnObjects: true }) as string[]}
          mock={<MockEmail />}
          reversed={false}
        />
        </div>

        <FeatureRow
          tag={t('landing.features.dealflow.tag')}
          title={t('landing.features.dealflow.title')}
          desc={t('landing.features.dealflow.desc')}
          bullets={t('landing.features.dealflow.bullets', { returnObjects: true }) as string[]}
          mock={<MockMemo />}
          reversed
        />

        <FeatureRow
          tag={t('landing.features.portfolio.tag')}
          title={t('landing.features.portfolio.title')}
          desc={t('landing.features.portfolio.desc')}
          bullets={t('landing.features.portfolio.bullets', { returnObjects: true }) as string[]}
          mock={<MockPortfolio />}
          reversed={false}
        />

        <FeatureRow
          tag={t('landing.features.import.tag')}
          title={t('landing.features.import.title')}
          desc={t('landing.features.import.desc')}
          bullets={t('landing.features.import.bullets', { returnObjects: true }) as string[]}
          mock={<MockImport />}
          reversed
        />

        <FeatureRow
          tag={t('landing.features.aiChat.tag')}
          title={t('landing.features.aiChat.title')}
          desc={t('landing.features.aiChat.desc')}
          bullets={t('landing.features.aiChat.bullets', { returnObjects: true }) as string[]}
          mock={<MockChat />}
          reversed={false}
        />

        <FeatureRow
          tag={t('landing.features.workspace.tag')}
          title={t('landing.features.workspace.title')}
          desc={t('landing.features.workspace.desc')}
          bullets={t('landing.features.workspace.bullets', { returnObjects: true }) as string[]}
          mock={<MockWorkspaces />}
          reversed
        />
      </div>

      {/* ─── USE CASES ─── */}
      <FadeSection>
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, textAlign: 'center' as const, marginBottom: 48 }}>
            {t('landing.useCases.title')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              { icon: <FileText size={24} />, title: t('landing.useCases.deck.title'), desc: t('landing.useCases.deck.desc') },
              { icon: <BarChart3 size={24} />, title: t('landing.useCases.reporting.title'), desc: t('landing.useCases.reporting.desc') },
              { icon: <MessageCircle size={24} />, title: t('landing.useCases.committee.title'), desc: t('landing.useCases.committee.desc') },
            ].map((c, i) => (
              <div key={i} style={{ background: COLORS.white, borderRadius: 16, padding: 32, boxShadow: COLORS.cardShadow, transition: 'box-shadow 0.3s' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: COLORS.beige, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: COLORS.black }}>{c.icon}</div>
                <h3 style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{c.title}</h3>
                <p style={{ fontFamily: sans, fontSize: 14, lineHeight: 1.7, color: COLORS.gray }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </FadeSection>

      {/* ─── CTA FINAL ─── */}
      <FadeSection>
        <section style={{ background: COLORS.beige, padding: '80px 24px', textAlign: 'center' as const }}>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, marginBottom: 16 }}>
            {t('landing.cta.title')}
          </h2>
          <p style={{ fontFamily: sans, fontSize: 16, color: COLORS.gray, marginBottom: 32 }}>
            {t('landing.cta.subtitle')}
          </p>
          <button onClick={goAuth} style={{ fontFamily: sans, fontSize: 16, fontWeight: 600, color: COLORS.white, background: COLORS.black, border: 'none', borderRadius: 10, padding: '16px 36px', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#333')}
            onMouseLeave={e => (e.currentTarget.style.background = COLORS.black)}
          >
            {t('landing.cta.button')} <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 6 }} />
          </button>
        </section>
      </FadeSection>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '28px 24px', maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/apple-touch-icon.png" alt="Albo" style={{ width: 24, height: 24, borderRadius: 6 }} />
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>Albo</span>
          <span style={{ fontFamily: sans, fontSize: 13, color: COLORS.grayLight, marginLeft: 8 }}>© 2026</span>
        </div>
        <div style={{ display: 'flex', gap: 24, fontFamily: sans, fontSize: 13 }}>
          <a href="/privacy" style={{ color: COLORS.gray, textDecoration: 'none' }}>{t('landing.footer.privacy')}</a>
          <a href="/terms" style={{ color: COLORS.gray, textDecoration: 'none' }}>{t('landing.footer.terms')}</a>
          <a href="https://alboteam.com" target="_blank" rel="noreferrer" style={{ color: COLORS.gray, textDecoration: 'none' }}>alboteam.com</a>
        </div>
      </footer>
    </div>
  );
}

function FeatureRow({ tag, title, desc, bullets, mock, reversed }: {
  tag: string; title: string; desc: string; bullets: string[]; mock: React.ReactNode; reversed: boolean;
}) {
  return (
    <FadeSection>
      <section style={{
        display: 'flex', gap: 48, alignItems: 'center', padding: '80px 0',
        flexDirection: reversed ? 'row-reverse' : 'row',
        flexWrap: 'wrap' as const,
      }}>
        <div style={{ flex: '1 1 380px', minWidth: 280 }}>
          <Tag>{tag}</Tag>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 700, lineHeight: 1.2, margin: '12px 0 16px' }}>{title}</h2>
          <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.7, color: COLORS.gray, marginBottom: 20 }}>{desc}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {bullets.map((b, i) => <Bullet key={i}>{b}</Bullet>)}
          </ul>
        </div>
        <div style={{ flex: '1 1 420px', minWidth: 300 }}>
          {mock}
        </div>
      </section>
    </FadeSection>
  );
}

function MockMemo() {
  return (
    <div style={{ background: COLORS.white, borderRadius: 16, boxShadow: COLORS.cardShadow, overflow: 'hidden' }}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' as const, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: sans, flexShrink: 0 }}>E</div>
            <div>
              <h3 style={{ fontFamily: sans, fontWeight: 700, fontSize: 15, margin: 0 }}>EcoLogis</h3>
              <p style={{ fontFamily: sans, fontSize: 12, color: COLORS.gray, margin: '4px 0 0' }}>Rénovation énergétique des copropriétés via une plateforme SaaS</p>
            </div>
          </div>
        </div>
        <div style={{ background: '#fafafa', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <p style={{ fontFamily: sans, fontSize: 13, lineHeight: 1.65, color: COLORS.gray, margin: 0 }}>
            Plateforme SaaS B2B de gestion de rénovation énergétique. CA 2024 de 280K€, croissance +180%. Recherche 800K€ en Seed.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 }}>
          <SBadge bg="#e8f5e9" color="#2e7d32">280K€ CA 2024</SBadge>
          <SBadge bg="#e3f2fd" color="#1565c0">+180% croissance</SBadge>
          <SBadge bg="#fce4ec" color="#c62828">12x ARR</SBadge>
        </div>
      </div>
    </div>
  );
}

function MockPortfolio() {
  const stats = [
    { label: 'Total investi', value: '220 000 €', bg: '#e8f5e9' },
    { label: 'Entreprises', value: '4', bg: '#e3f2fd' },
    { label: 'Secteurs', value: '4', bg: '#fff8e1' },
    { label: 'Ticket moyen', value: '55 000 €', bg: '#fce4ec' },
  ];
  const rows = [
    { name: 'Aircall', domain: 'aircall.io', sector: 'SaaS B2B', sColor: '#e3f2fd', sTxt: '#1565c0', amount: '80 000 €' },
    { name: 'Alan', domain: 'alan.com', sector: 'InsurTech', sColor: '#e8f5e9', sTxt: '#2e7d32', amount: '60 000 €' },
    { name: 'Pennylane', domain: 'pennylane.com', sector: 'FinTech', sColor: '#fff8e1', sTxt: '#f57f17', amount: '45 000 €' },
    { name: 'Swile', domain: 'swile.co', sector: 'HRTech', sColor: '#f3e5f5', sTxt: '#7b1fa2', amount: '35 000 €' },
  ];
  return (
    <div style={{ background: COLORS.white, borderRadius: 16, boxShadow: COLORS.cardShadow, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, padding: 16 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontFamily: sans, fontSize: 11, color: COLORS.gray }}>{s.label}</div>
            <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: COLORS.black, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: sans, fontSize: 13 }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LogoImg domain={r.domain} alt={r.name} size={32} />
                  {r.name}
                </div>
              </td>
              <td style={{ padding: '10px 16px' }}><SBadge bg={r.sColor} color={r.sTxt}>{r.sector}</SBadge></td>
              <td style={{ padding: '10px 16px', textAlign: 'right' as const, color: COLORS.gray }}>{r.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockImport() {
  const imported = [
    { name: 'Aircall', domain: 'aircall.io', sector: 'SaaS B2B', amount: '80 000 €' },
    { name: 'Alan', domain: 'alan.com', sector: 'InsurTech', amount: '60 000 €' },
    { name: 'Pennylane', domain: 'pennylane.com', sector: 'FinTech', amount: '45 000 €' },
  ];
  return (
    <div style={{ background: COLORS.white, borderRadius: 16, boxShadow: COLORS.cardShadow, overflow: 'hidden' }}>
      <div style={{ border: '2px dashed #d0cdc8', borderRadius: 12, margin: 16, padding: '28px 16px', textAlign: 'center' as const }}>
        <Upload size={28} style={{ color: COLORS.grayLight, margin: '0 auto 8px', display: 'block' }} />
        <p style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: COLORS.black, margin: 0 }}>Drag & drop or click to select</p>
        <p style={{ fontFamily: sans, fontSize: 11, color: COLORS.grayLight, margin: '4px 0 0' }}>CSV, Excel (.xlsx, .xls)</p>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: sans, fontSize: 13 }}>
        <tbody>
          {imported.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LogoImg domain={r.domain} alt={r.name} size={32} />
                  {r.name}
                </div>
              </td>
              <td style={{ padding: '10px 16px', color: COLORS.gray }}>{r.sector}</td>
              <td style={{ padding: '10px 16px', color: COLORS.gray }}>{r.amount}</td>
              <td style={{ padding: '10px 16px' }}>
                <SBadge bg="#e8f5e9" color="#2e7d32">✓</SBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockChat() {
  return (
    <div style={{ background: COLORS.white, borderRadius: 16, boxShadow: COLORS.cardShadow, padding: 20, display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
      <div style={{ alignSelf: 'flex-end', background: COLORS.beige, borderRadius: '14px 14px 4px 14px', padding: '10px 16px', maxWidth: '80%', fontFamily: sans, fontSize: 13, lineHeight: 1.6 }}>
        Quels sont les deals SaaS avec un ARR &gt; 500K€ reçus ce mois ?
      </div>
      <div style={{ alignSelf: 'flex-start', background: '#f8f8f8', border: '1px solid #eee', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', maxWidth: '85%', fontFamily: sans, fontSize: 13, lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 10px' }}>3 deals found:</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
          <thead><tr style={{ borderBottom: '1px solid #e0e0e0' }}>
            {['Name', 'ARR', 'Growth', 'Stage'].map(h => <th key={h} style={{ textAlign: 'left' as const, padding: '4px 8px', fontWeight: 600, fontSize: 11, color: COLORS.grayLight }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[
              ['DataSync', '€820K', '+140%', 'Series A'],
              ['CloudPay', '€1.2M', '+95%', 'Series A'],
              ['MetricFlow', '€540K', '+210%', 'Seed'],
            ].map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                {r.map((c, j) => <td key={j} style={{ padding: '4px 8px', color: j === 0 ? COLORS.black : COLORS.gray, fontWeight: j === 0 ? 600 : 400 }}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ alignSelf: 'flex-end', background: COLORS.beige, borderRadius: '14px 14px 4px 14px', padding: '10px 16px', maxWidth: '80%', fontFamily: sans, fontSize: 13 }}>
        Compare their unit economics
      </div>
      <div style={{ alignSelf: 'flex-start', background: '#f8f8f8', border: '1px solid #eee', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', maxWidth: '85%', fontFamily: sans, fontSize: 13, color: COLORS.gray }}>
        Here is the comparison of the 3 deals…
        <span style={{ display: 'inline-block', width: 6, height: 14, background: COLORS.black, marginLeft: 2, animation: 'blink 1s steps(2) infinite', verticalAlign: 'middle' }} />
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

function MockWorkspaces() {
  const ws = [
    { name: 'Mon portefeuille', initial: 'M', bg: '#1565c0', meta: '50 companies · 5M€ · 3 members', active: true },
    { name: 'Angels Club', initial: 'A', bg: '#e65100', meta: '12 companies · 1.2M€ · 5 members', active: false },
    { name: 'Side Fund', initial: 'S', bg: '#7b1fa2', meta: '8 companies · 800K€ · 2 members', active: false },
  ];
  return (
    <div style={{ background: COLORS.white, borderRadius: 16, boxShadow: COLORS.cardShadow, padding: 8 }}>
      {ws.map((w, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 10, background: w.active ? '#f6f6f3' : 'transparent', margin: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: w.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: sans }}>
              {w.initial}
            </div>
            <div>
              <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 14 }}>{w.name}</div>
              <div style={{ fontFamily: sans, fontSize: 12, color: COLORS.grayLight }}>{w.meta}</div>
            </div>
          </div>
          {w.active && <span style={{ fontSize: 10, fontWeight: 600, fontFamily: sans, background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: 6 }}>Active</span>}
        </div>
      ))}
    </div>
  );
}

function MockEmail() {
  const emails = [
    { from: 'contact@backmarket.com', match: 'Back Market', domain: 'backmarket.com' },
    { from: 'finance@qonto.com', match: 'Qonto', domain: 'qonto.com' },
    { from: 'reporting@doctolib.fr', match: 'Doctolib', domain: 'doctolib.fr' },
  ];
  return (
    <div style={{ background: COLORS.white, borderRadius: 16, boxShadow: COLORS.cardShadow, padding: 20 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <SBadge bg="#e8f5e9" color="#2e7d32">Gmail ✓</SBadge>
        <SBadge bg="#e3f2fd" color="#1565c0">Outlook ✓</SBadge>
        <span style={{ fontFamily: sans, fontSize: 12, color: COLORS.grayLight, marginLeft: 'auto' }}>3 247 emails synced</span>
      </div>
      {emails.map((e, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogoImg domain={e.domain} alt={e.match} size={32} />
            <span style={{ fontFamily: sans, fontSize: 13, color: COLORS.gray }}>{e.from}</span>
          </div>
          <SBadge bg="#e3f2fd" color="#1565c0">{`→ ${e.match}`}</SBadge>
        </div>
      ))}
    </div>
  );
}
