import { Resend } from 'resend'

// Get a free API key at https://resend.com (3,000 emails/month free tier).
// Set it as an environment variable, never hardcode it:
//   export RESEND_API_KEY=re_xxxxxxxx
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS = process.env.RESEND_FROM || 'Clean Cutz <onboarding@resend.dev>'

// Resend's sandbox "onboarding@resend.dev" sender works immediately with no setup,
// but only delivers to the email address you signed up to Resend with. Once you
// verify your own domain in the Resend dashboard, switch FROM_ADDRESS to something
// like "Clean Cutz <noreply@yourdomain.com>" to send to any real user.

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

if (!RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY is not set. Password reset emails will be logged to the console instead of sent.')
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const subject = 'Reset your Clean Cutz password'
  const text = `Hi ${name},\n\nSomeone requested a password reset for your Clean Cutz account. If this was you, set a new password here:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can safely ignore this email.\n\n— Clean Cutz`

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">Reset your password</h2>
      <p style="color: #555;">Hi ${escapeHtml(name)},</p>
      <p style="color: #555;">
        Someone requested a password reset for your Clean Cutz account.
        If this was you, click below to set a new password.
      </p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}"
           style="background:#3b82f6; color:white; padding:12px 20px; border-radius:8px;
                  text-decoration:none; font-weight:600; display:inline-block;">
          Reset password
        </a>
      </p>
      <p style="color: #888; font-size: 0.85rem;">
        This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `

  // No API key configured (e.g. local dev) -- log instead of failing outright
  if (!resend) {
    console.log('\n📧 [DEV] Password reset email (not actually sent):')
    console.log(`   To: ${to}`)
    console.log(`   Reset URL: ${resetUrl}\n`)
    return { devMode: true }
  }

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    text,
    html
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error('Failed to send reset email')
  }

  return data
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}