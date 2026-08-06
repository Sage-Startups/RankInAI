import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/** Favicon generated from the RankInAI mark — no external assets. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 5,
          padding: '14px 10px',
          background: 'linear-gradient(135deg, #5844D8 0%, #0E7490 100%)',
          borderRadius: 14,
        }}
      >
        <div style={{ width: 9, height: 16, background: 'rgba(255,255,255,0.62)', borderRadius: 3 }} />
        <div style={{ width: 9, height: 26, background: 'rgba(255,255,255,0.82)', borderRadius: 3 }} />
        <div style={{ width: 9, height: 36, background: '#ffffff', borderRadius: 3 }} />
      </div>
    ),
    { ...size },
  );
}
