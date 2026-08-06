import { ImageResponse } from 'next/og';

import { SITE } from '@/lib/site-config';

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social sharing image generated from the site's own branding.
 * No third-party artwork is used.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#05070f',
          backgroundImage:
            'radial-gradient(900px 500px at 10% -10%, rgba(109,94,240,0.35), transparent 60%), radial-gradient(700px 420px at 92% 5%, rgba(34,211,238,0.20), transparent 62%)',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 68,
              height: 68,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 6,
              padding: '16px 12px',
              background: 'linear-gradient(135deg, #5844D8 0%, #0E7490 100%)',
              borderRadius: 18,
            }}
          >
            <div
              style={{
                width: 10,
                height: 16,
                background: 'rgba(255,255,255,0.62)',
                borderRadius: 3,
              }}
            />
            <div
              style={{
                width: 10,
                height: 26,
                background: 'rgba(255,255,255,0.82)',
                borderRadius: 3,
              }}
            />
            <div style={{ width: 10, height: 36, background: '#ffffff', borderRadius: 3 }} />
          </div>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            <span style={{ color: '#ffffff' }}>Rank</span>
            <span style={{ color: '#8f7df5' }}>In</span>
            <span style={{ color: '#22d3ee' }}>AI</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 66,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: -2.4,
              lineHeight: 1.08,
              maxWidth: 940,
              display: 'flex',
            }}
          >
            Can AI understand and recommend your business?
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 27,
              color: '#a3adc9',
              lineHeight: 1.4,
              maxWidth: 900,
              display: 'flex',
            }}
          >
            AI visibility and Generative Engine Optimization audits — technical accessibility,
            entity clarity, content authority and answer readiness.
          </div>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 22, color: '#67e8f9' }}
        >
          <span>7 scored categories</span>
          <span style={{ color: '#33406e' }}>·</span>
          <span>~70 deterministic checks</span>
          <span style={{ color: '#33406e' }}>·</span>
          <span>Audits from $49</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
