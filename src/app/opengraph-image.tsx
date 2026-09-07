import { ImageResponse } from 'next/og';

import { SITE } from '@/lib/site-config';

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social sharing image generated from the site's own branding.
 * No third-party artwork is used.
 *
 * The mark is drawn for a dark background: the pale outer circle becomes a dim
 * teal and the centre becomes near-white, matching how the logo component
 * renders itself on the marketing shell.
 */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
<circle cx="20" cy="20" r="18.4" stroke="#2a5f58" stroke-width="1.5"/>
<g stroke-width="2.9" stroke-linecap="round">
<path d="M23.75 6.93 A13.6 13.6 0 0 1 33.57 19.05" stroke="#4fc7b8"/>
<path d="M33.47 21.89 A13.6 13.6 0 0 1 22.83 33.30" stroke="#4fc7b8"/>
<path d="M17.17 33.30 A13.6 13.6 0 0 1 6.53 21.89" stroke="#c89a4b"/>
<path d="M6.43 19.05 A13.6 13.6 0 0 1 16.25 6.93" stroke="#c89a4b"/>
</g>
<circle cx="20" cy="20" r="5.4" fill="#f8fafc"/>
</svg>`;

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
            'radial-gradient(900px 500px at 10% -10%, rgba(79,199,184,0.28), transparent 60%), radial-gradient(700px 420px at 92% 5%, rgba(200,154,75,0.18), transparent 62%)',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img
            width={72}
            height={72}
            alt=""
            src={`data:image/svg+xml;utf8,${encodeURIComponent(MARK)}`}
          />
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            <span style={{ color: '#ffffff' }}>Rank</span>
            <span style={{ color: '#5ccec1' }}>Clear</span>
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
          style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 22, color: '#7fdfd3' }}
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
