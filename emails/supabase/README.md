# Supabase Auth Email Templates

Branded HTML email templates for Supabase's built-in auth flows.
These files use Supabase's Go template variables (e.g. `{{ .ConfirmationURL }}`).

## Where to paste each file

Go to **Supabase Dashboard → Authentication → Email Templates**.

| File | Supabase template slot |
|------|------------------------|
| `confirm-signup.html` | **Confirm signup** |
| `reset-password.html` | **Reset password** |
| `magic-link.html` | **Magic Link** |
| `change-email.html` | **Change Email Address** |
| `invite.html` | **Invite User** |

Copy the full file contents and paste them into the **Message body (HTML)** field of each slot. Update the **Subject** fields to match:

| Slot | Subject |
|------|---------|
| Confirm signup | `Confirmá tu cuenta en mangui` |
| Reset password | `Restablecé tu contraseña en mangui` |
| Magic Link | `Tu acceso a mangui` |
| Change Email | `Confirmá tu nuevo email en mangui` |
| Invite User | `Te invitaron a mangui` |

## SMTP settings (Resend)

Configure these under **Supabase Dashboard → Project Settings → Auth → SMTP Provider**:

| Setting | Value |
|---------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your `RESEND_API_KEY` (starts with `re_...`) |
| Sender email | `hola@mangui.com.ar` |
| Sender name | `mangui` |

> The domain `mangui.com.ar` must be verified in your Resend account (Resend → Domains).
> SSL/TLS should be enabled (port 465 uses implicit TLS).
