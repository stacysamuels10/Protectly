import 'server-only'
import { Resend } from 'resend'
import { env } from '@/env'

const resend = new Resend(env.RESEND_API_KEY)

export async function sendEmail(opts: {
  to: string
  subject: string
  react: React.ReactElement
}) {
  const { error } = await resend.emails.send({
    from: `PriCal Notifications <${env.EMAIL_FROM}>`,
    ...opts,
  })
  if (error) throw new Error(`Email delivery failed: ${error.message}`)
}
