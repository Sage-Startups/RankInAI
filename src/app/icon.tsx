import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/**
 * Favicon generated from the RankClear mark — no external assets.
 *
 * A deliberately simplified version of the logo: the pale outer circle is
 * dropped and the arcs are thickened, because at the 16px a browser tab
 * actually renders, a 1.5px ring is invisible and thin arcs turn to mush. The
 * identity that survives at that size is the mint/gold ring around a dark
 * centre, so that is what the icon keeps.
 */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
<g stroke-width="4.2" stroke-linecap="round">
<path d="M23.75 6.93 A13.6 13.6 0 0 1 33.57 19.05" stroke="#4fc7b8"/>
<path d="M33.47 21.89 A13.6 13.6 0 0 1 22.83 33.30" stroke="#4fc7b8"/>
<path d="M17.17 33.30 A13.6 13.6 0 0 1 6.53 21.89" stroke="#c89a4b"/>
<path d="M6.43 19.05 A13.6 13.6 0 0 1 16.25 6.93" stroke="#c89a4b"/>
</g>
<circle cx="20" cy="20" r="6.6" fill="#101a26"/>
</svg>`;

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          borderRadius: 14,
        }}
      >
        <img
          width={58}
          height={58}
          alt=""
          src={`data:image/svg+xml;utf8,${encodeURIComponent(MARK)}`}
        />
      </div>
    ),
    { ...size },
  );
}
