import { getEnv } from '@/lib/env';

/**
 * Transactional email with a pluggable provider.
 *
 * `console` (the default in development and test) records the message in
 * memory and logs a summary, so password-reset flows are fully exercisable
 * without an email provider. `resend` posts to the Resend HTTP API.
 *
 * Nothing here ever logs a full token URL in production.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  provider: string;
  error: string | null;
}

/** Captured messages, used by the dev mailbox and the integration tests. */
const captured: Array<EmailMessage & { sentAt: Date }> = [];

export function capturedEmails(): ReadonlyArray<EmailMessage & { sentAt: Date }> {
  return captured;
}

export function clearCapturedEmails(): void {
  captured.length = 0;
}

export function lastEmailTo(address: string): (EmailMessage & { sentAt: Date }) | undefined {
  return [...captured].reverse().find((m) => m.to.toLowerCase() === address.toLowerCase());
}

async function sendViaResend(message: EmailMessage): Promise<SendResult> {
  const env = getEnv();
  if (!env.EMAIL_PROVIDER_API_KEY) {
    return { ok: false, provider: 'resend', error: 'EMAIL_PROVIDER_API_KEY is not set.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, provider: 'resend', error: `HTTP ${response.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true, provider: 'resend', error: null };
  } catch (error) {
    return {
      ok: false,
      provider: 'resend',
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const env = getEnv();

  if (env.EMAIL_PROVIDER === 'resend') {
    return sendViaResend(message);
  }

  captured.push({ ...message, sentAt: new Date() });
  if (captured.length > 200) captured.splice(0, captured.length - 200);

  if (!env.isProduction) {
    // Development convenience: surface the link so a reset can be completed
    // locally without an inbox.
    const link = message.text.match(/https?:\/\/\S+/)?.[0];
    console.info(
      `[email:console] to=${message.to} subject="${message.subject}"${link ? ` link=${link}` : ''}`,
    );
  } else {
    console.info(`[email:console] to=${message.to} subject="${message.subject}"`);
  }

  return { ok: true, provider: 'console', error: null };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function layout(title: string, body: string, footerNote?: string): string {
  const env = getEnv();
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#0b1020;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#0b1020;padding:22px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Rank<span style="color:#8b7cf6;">In</span><span style="color:#22d3ee;">AI</span></span>
        </td></tr>
        <tr><td style="padding:28px;color:#0f172a;font-size:15px;line-height:1.6;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#0b1020;">${escapeHtml(title)}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;">
          ${footerNote ? `${escapeHtml(footerNote)}<br><br>` : ''}
          RankInAI — AI visibility and Generative Engine Optimization audits.<br>
          Questions? Reply to this email or contact ${escapeHtml(env.SUPPORT_EMAIL)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#6d5ef0;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:600;font-size:15px;">${escapeHtml(label)}</a></p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendResult> {
  return sendEmail({
    to,
    subject: 'Reset your RankInAI password',
    html: layout(
      'Reset your password',
      `<p>We received a request to reset the password for this RankInAI account.</p>
       ${button(resetUrl, 'Choose a new password')}
       <p style="color:#475569;font-size:13px;">This link expires in 60 minutes and can only be used once. If you did not request a password reset, no action is needed — your password has not changed.</p>`,
      'For your security, never share this link with anyone.',
    ),
    text: `Reset your RankInAI password\n\nOpen this link to choose a new password:\n${resetUrl}\n\nThis link expires in 60 minutes and can only be used once. If you did not request a reset, no action is needed.`,
  });
}

export async function sendEmailVerification(to: string, verifyUrl: string): Promise<SendResult> {
  return sendEmail({
    to,
    subject: 'Confirm your RankInAI email address',
    html: layout(
      'Confirm your email address',
      `<p>Thanks for creating a RankInAI account. Confirm your email address to secure your account and receive audit notifications.</p>
       ${button(verifyUrl, 'Confirm email address')}
       <p style="color:#475569;font-size:13px;">This link expires in 24 hours.</p>`,
    ),
    text: `Confirm your RankInAI email address\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendWelcomeEmail(to: string, name: string | null): Promise<SendResult> {
  const env = getEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  return sendEmail({
    to,
    subject: 'Welcome to RankInAI',
    html: layout(
      `Welcome${name ? `, ${escapeHtml(name)}` : ''}`,
      `<p>Your RankInAI account is ready. RankInAI audits how well AI systems and answer engines can discover, understand and cite your website.</p>
       <p>Start with a full audit of your site, or open the sample report to see what one looks like.</p>
       ${button(`${appUrl}/dashboard/audits/new`, 'Run your first audit')}
       <p style="color:#475569;font-size:13px;">Every audit scores seven categories, lists the evidence behind each finding and gives you a prioritized action plan.</p>`,
    ),
    text: `Welcome to RankInAI.\n\nYour account is ready. Start your first audit: ${appUrl}/dashboard/audits/new`,
  });
}

export async function sendAuditCompleteEmail(params: {
  to: string;
  businessName: string;
  score: number;
  auditId: string;
}): Promise<SendResult> {
  const env = getEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const url = `${appUrl}/dashboard/audits/${params.auditId}`;
  return sendEmail({
    to: params.to,
    subject: `Your RankInAI audit for ${params.businessName} is ready`,
    html: layout(
      'Your audit is ready',
      `<p>The AI visibility audit for <strong>${escapeHtml(params.businessName)}</strong> has finished.</p>
       <p style="font-size:34px;font-weight:700;color:#0b1020;margin:18px 0 4px;">${params.score}<span style="font-size:18px;color:#64748b;">/100</span></p>
       <p style="color:#475569;margin-top:0;">Overall AI Visibility Score</p>
       ${button(url, 'Open the full report')}`,
    ),
    text: `Your RankInAI audit for ${params.businessName} is ready. Overall AI Visibility Score: ${params.score}/100.\n\nOpen the report: ${url}`,
  });
}
