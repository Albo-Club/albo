import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef, useCallback } from 'react';
import { Check, FileText, BarChart3, MessageCircle, Mail, ArrowRight, Upload } from 'lucide-react';

/* ──────────────────────────────────────────────
   Inline styles – keeps everything in one file
   ────────────────────────────────────────────── */
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

/* ── Intersection Observer hook for fade-in ── */
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

/* ── Reusable animated section wrapper ── */
function FadeSection({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: 0, transform: 'translateY(28px)', transition: 'opacity 0.7s ease, transform 0.7s ease', ...style }}
    >
      {children}
    </div>
  );
}

/* ── Small UI atoms ── */
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
        src={`https://img.logo.dev/${domain}?token=${LOGO_TOKEN}&size=32&format=png`}
        alt={alt || domain}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover' }}
        loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; const sib = e.currentTarget.nextElementSibling as HTMLElement; if (sib) sib.style.display = 'flex'; }}
      />
      <span style={{ display: 'none', width: size, height: size, borderRadius: '50%', background: fallbackBg, color: 'white', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.44, fontWeight: 700, fontFamily: sans, position: 'absolute', top: 0, left: 0 }}>
        {initial}
      </span>
    </span>
  );
}

/* ══════════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════════ */
export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={goAuth} style={{ fontFamily: sans, fontSize: 14, fontWeight: 500, color: COLORS.black, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px' }}>
              Se connecter
            </button>
            <button onClick={goAuth} style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: COLORS.white, background: COLORS.black, border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#333')}
              onMouseLeave={e => (e.currentTarget.style.background = COLORS.black)}
            >
              Commencer
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' as const }}>
        <FadeSection>
          <img src="/apple-touch-icon.png" alt="Albo" style={{ width: 72, height: 72, borderRadius: 16, margin: '0 auto 20px' }} />
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: COLORS.grayLight, marginBottom: 28 }}>
            Notre CRM, mais pour vous
          </p>
          <h1 style={{ fontFamily: serif, fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 700, lineHeight: 1.15, margin: '0 0 24px', color: COLORS.black }}>
            Suivez vos participations avec l'attention qu'elles méritent
          </h1>
          <p style={{ fontFamily: sans, fontSize: 'clamp(16px, 2vw, 19px)', lineHeight: 1.7, color: COLORS.gray, maxWidth: 640, margin: '0 auto 36px' }}>
            Trier, suivre et analyser vos échanges n'a jamais été aussi simple. Décuplez le potentiel de votre boîte mail grâce à l'analyse historique de chaque échange — depuis le premier pitch deck reçu jusqu'au dernier reporting.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <button onClick={goAuth} style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: COLORS.white, background: COLORS.black, border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#333')}
              onMouseLeave={e => (e.currentTarget.style.background = COLORS.black)}
            >
              Créer un compte gratuitement
            </button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: COLORS.black, background: 'none', border: `1.5px solid ${COLORS.black}`, borderRadius: 10, padding: '14px 28px', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              Découvrir
            </button>
          </div>
        </FadeSection>

        {/* Hero mock – dealflow table */}
        <FadeSection style={{ marginTop: 56 }}>
          <div style={{ background: COLORS.white, borderRadius: 16, boxShadow: COLORS.cardShadow, overflow: 'hidden', textAlign: 'left' as const }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #eee', fontFamily: sans, fontWeight: 600, fontSize: 14, color: COLORS.gray }}>Dealflow récent</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: sans, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  {['Entreprise', 'Secteur', 'Montant', 'Type'].map(h => (
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
              ['80+', 'Projets accompagnés'],
              ['5M€', 'Investis'],
              ['50+', 'Entreprises suivies'],
              ['3 000+', 'Emails synchronisés'],
            ].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: COLORS.black }}>{n}</div>
                <div style={{ fontFamily: sans, fontSize: 13, color: COLORS.gray, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </section>
      </FadeSection>

      {/* ─── FEATURES ─── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        {/* Feature 1 – Email sync */}
        <div id="features">
        <FeatureRow
          tag="EMAIL SYNC"
          title="Votre boîte mail, enfin utile"
          desc="Connectez Gmail ou Outlook. Albo associe automatiquement chaque email à vos deals et sociétés en portefeuille. Les reportings investisseurs sont détectés et analysés sans aucune intervention."
          bullets={[
            'Synchronisation Gmail & Outlook en temps réel',
            'Association automatique emails ↔ sociétés',
            'Détection automatique des reportings investisseurs',
            'Des milliers d\'emails déjà traités',
          ]}
          mock={<MockEmail />}
          reversed={false}
        />
        </div>

        {/* Feature 2 – Deck analysis */}
        <FeatureRow
          tag="DEALFLOW"
          title="Envoyez un deck, recevez un mémo d'investissement"
          desc="Transférez n'importe quel pitch deck à deck@alboteam.com. En quelques minutes, l'IA génère un mémo complet avec l'historique de tous vos échanges passés avec l'entreprise : premiers emails, évolution du business plan, comparaison avec le deck initial."
          bullets={[
            'Analyse IA en moins de 5 minutes',
            'Support PDF, Notion, DocSend, Google Drive',
            'Mémo structuré : résumé, deal structure, marché, équipe',
            'Tags automatiques : secteur, stade, type de financement',
          ]}
          mock={<MockMemo />}
          reversed
        />

        {/* Feature 3 – Portfolio */}
        <FeatureRow
          tag="PORTFOLIO"
          title="50+ entreprises, zéro tableur Excel"
          desc="Suivez l'intégralité de vos participations dans une vue unifiée. Montants investis, secteurs, types d'instruments, taux de survie — tout est calculé automatiquement."
          bullets={[
            'Vue portfolio complète avec filtres par secteur et type',
            'Métriques agrégées : TVPI, taux de survie, capital déployé',
            "Score de santé IA par entreprise",
            'Historique des reportings avec analyse automatique',
          ]}
          mock={<MockPortfolio />}
          reversed={false}
        />

        {/* Feature 4 – Import CSV/Excel */}
        <FeatureRow
          tag="IMPORT"
          title="Importez votre portefeuille en un clic"
          desc="Téléversez votre fichier Excel ou CSV avec vos participations existantes. Albo reconnaît automatiquement les colonnes, enrichit les données et crée votre portefeuille complet en quelques secondes."
          bullets={[
            'Import Excel (.xlsx) et CSV en glisser-déposer',
            'Reconnaissance automatique des colonnes (nom, montant, date, secteur)',
            'Enrichissement automatique : logos, sites web, descriptions',
            'Mise à jour en masse sans ressaisie',
          ]}
          mock={<MockImport />}
          reversed
        />

        {/* Feature 5 – AI Chat */}
        <FeatureRow
          tag="IA CONVERSATIONNELLE"
          title="Discuter avec vos documents n'a jamais été aussi simple"
          desc="Posez n'importe quelle question sur vos deals ou votre portefeuille. L'IA a lu tous vos pitch decks, tous vos reportings, et croise les informations instantanément."
          bullets={[
            '"Quel est le runway de TechVision ?" → Réponse instantanée',
            '"Compare les métriques de mes deals SaaS" → Tableau comparatif',
            '"Résume le dernier reporting de Climate Club" → Synthèse',
            'Recherche sémantique dans tous vos documents et emails',
          ]}
          mock={<MockChat />}
          reversed={false}
        />

        {/* Feature 6 – Multi-workspace */}
        <FeatureRow
          tag="ORGANISATION"
          title="Un espace par véhicule, zéro contamination"
          desc="Chaque véhicule d'investissement vit dans un espace séparé et étanche. Partagez les deals entre co-investisseurs sans mélanger les données."
          bullets={[
            "Isolation complète entre véhicules d'investissement",
            'Partage automatique des deals entre co-investisseurs',
            'Rôles : owner, admin, member',
            'Switching instantané entre workspaces',
          ]}
          mock={<MockWorkspaces />}
          reversed
        />
      </div>

      {/* ─── USE CASES ─── */}
      <FadeSection>
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, textAlign: 'center' as const, marginBottom: 48 }}>
            Conçu pour chaque étape de votre workflow
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              { icon: <FileText size={24} />, title: 'Vous recevez un pitch deck', desc: "Transférez-le à deck@alboteam.com. En 5 minutes : mémo complet, métriques extraites, deal créé et partagé avec votre workspace." },
              { icon: <BarChart3 size={24} />, title: 'Une startup vous envoie un reporting', desc: "Albo le détecte automatiquement dans vos emails, extrait les métriques, met à jour le profil de la société et vous notifie." },
              { icon: <MessageCircle size={24} />, title: 'Vous préparez un comité', desc: "Demandez à l'IA de comparer 3 deals, générer une synthèse ou retrouver un email échangé il y a 6 mois. Tout est indexé." },
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
            Rejoignez les investisseurs qui ont simplifié leur quotidien
          </h2>
          <p style={{ fontFamily: sans, fontSize: 16, color: COLORS.gray, marginBottom: 32 }}>
            Gratuit pour commencer. Pas de carte bancaire requise.
          </p>
          <button onClick={goAuth} style={{ fontFamily: sans, fontSize: 16, fontWeight: 600, color: COLORS.white, background: COLORS.black, border: 'none', borderRadius: 10, padding: '16px 36px', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#333')}
            onMouseLeave={e => (e.currentTarget.style.background = COLORS.black)}
          >
            Créer mon compte <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 6 }} />
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
          <a href="/privacy" style={{ color: COLORS.gray, textDecoration: 'none' }}>Confidentialité</a>
          <a href="/terms" style={{ color: COLORS.gray, textDecoration: 'none' }}>CGU</a>
          <a href="https://alboteam.com" target="_blank" rel="noreferrer" style={{ color: COLORS.gray, textDecoration: 'none' }}>alboteam.com</a>
        </div>
      </footer>
    </div>
  );
}

/* ══════════════════════════════════════════════
   FEATURE ROW LAYOUT
   ══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   MOCK COMPONENTS
   ══════════════════════════════════════════════ */

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
          <SBadge bg="#fff3e0" color="#e65100">En cours d'analyse</SBadge>
        </div>
        <div style={{ background: '#fafafa', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <p style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: COLORS.grayLight, marginBottom: 6 }}>En 30 secondes</p>
          <p style={{ fontFamily: sans, fontSize: 13, lineHeight: 1.65, color: COLORS.gray, margin: 0 }}>
            Plateforme SaaS B2B de gestion de rénovation énergétique. CA 2024 de 280K€, croissance +180%. Recherche 800K€ en Seed.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 }}>
          <SBadge bg="#e8f5e9" color="#2e7d32">280K€ CA 2024</SBadge>
          <SBadge bg="#e3f2fd" color="#1565c0">+180% croissance</SBadge>
          <SBadge bg="#fce4ec" color="#c62828">12x ARR</SBadge>
        </div>
        <div style={{ display: 'flex', gap: 24, fontFamily: sans, fontSize: 12, color: COLORS.gray, flexWrap: 'wrap' as const }}>
          <span><b style={{ color: COLORS.black }}>Montant</b> €800K</span>
          <span><b style={{ color: COLORS.black }}>Instrument</b> BSA-AIR</span>
          <span><b style={{ color: COLORS.black }}>Stade</b> Seed</span>
          <span><b style={{ color: COLORS.black }}>Secteur</b> GreenTech</span>
          <span><b style={{ color: COLORS.black }}>Source</b> Email</span>
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
      {/* Drop zone */}
      <div style={{ border: '2px dashed #d0cdc8', borderRadius: 12, margin: 16, padding: '28px 16px', textAlign: 'center' as const }}>
        <Upload size={28} style={{ color: COLORS.grayLight, margin: '0 auto 8px', display: 'block' }} />
        <p style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: COLORS.black, margin: 0 }}>Glissez votre fichier ici ou cliquez pour sélectionner</p>
        <p style={{ fontFamily: sans, fontSize: 11, color: COLORS.grayLight, margin: '4px 0 0' }}>CSV, Excel (.xlsx, .xls)</p>
      </div>
      {/* Imported preview */}
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: sans, fontSize: 13 }}>
        <thead>
          <tr style={{ borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>
            {['Entreprise', 'Secteur', 'Montant', ''].map(h => (
              <th key={h} style={{ padding: '8px 16px', textAlign: 'left' as const, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: COLORS.grayLight }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {imported.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
              <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LogoImg domain={r.domain} alt={r.name} size={32} />
                  {r.name}
                </div>
              </td>
              <td style={{ padding: '10px 16px', color: COLORS.gray }}>{r.sector}</td>
              <td style={{ padding: '10px 16px', color: COLORS.gray }}>{r.amount}</td>
              <td style={{ padding: '10px 16px' }}>
                <SBadge bg="#e8f5e9" color="#2e7d32">✓ Importé</SBadge>
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
        <p style={{ margin: '0 0 10px' }}>Voici les 3 deals correspondants :</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
          <thead><tr style={{ borderBottom: '1px solid #e0e0e0' }}>
            {['Nom', 'ARR', 'Growth', 'Stade'].map(h => <th key={h} style={{ textAlign: 'left' as const, padding: '4px 8px', fontWeight: 600, fontSize: 11, color: COLORS.grayLight }}>{h}</th>)}
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
        Compare leur unit economics
      </div>
      <div style={{ alignSelf: 'flex-start', background: '#f8f8f8', border: '1px solid #eee', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', maxWidth: '85%', fontFamily: sans, fontSize: 13, color: COLORS.gray }}>
        Voici la comparaison des 3 deals sur leurs métriques unitaires…
        <span style={{ display: 'inline-block', width: 6, height: 14, background: COLORS.black, marginLeft: 2, animation: 'blink 1s steps(2) infinite', verticalAlign: 'middle' }} />
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

function MockWorkspaces() {
  const ws = [
    { name: 'Mon portefeuille', initial: 'M', bg: '#1565c0', meta: '50 entreprises · 5M€ · 3 membres', active: true },
    { name: 'Angels Club', initial: 'A', bg: '#e65100', meta: '12 entreprises · 1.2M€ · 5 membres', active: false },
    { name: 'Side Fund', initial: 'S', bg: '#7b1fa2', meta: '8 entreprises · 800K€ · 2 membres', active: false },
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
          {w.active && <span style={{ fontSize: 10, fontWeight: 600, fontFamily: sans, background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: 6 }}>Actif</span>}
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
        <span style={{ fontFamily: sans, fontSize: 12, color: COLORS.grayLight, marginLeft: 'auto' }}>3 247 emails synchronisés</span>
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
