# Auth Module

This module handles email-based user registration, email verification, and password reset flows.

## Email Registration

- Endpoint: `POST /v1/auth/register/email`
- Request Body: `{ email: string; username: string; password: string }`
- Behavior:
  1. Validates email and password strength.
  2. Hashes password and creates a new `UserEntity` with `isEmailVerified: false`.
  3. Sets access and refresh tokens as secure, HttpOnly cookies and in the response body.

## Email Verification

- Request Verification:
  - Endpoint: `POST /v1/auth/verify-email/request`
  - Request Body: `{ email: string }`
  - Behavior: Finds the user by email, generates a verification token, stores an `EmailVerificationEntity` with expiration, and sends a Mailgun email containing a link: `GET /v1/auth/verify-email?token=<token>`.

- Verify Email:
  - Endpoint: `POST /v1/auth/verify-email?token=<token>`
  - Query: `token` (string)
  - Behavior: Validates the token, sets `user.registrationData.isEmailVerified = true`, deletes the verification record, and returns success.

## Password Reset

- Request Reset:
  - Endpoint: `POST /v1/auth/password-reset/request`
  - Request Body: `{ email: string }`
  - Behavior: Finds the user, generates a reset token, stores a `PasswordResetEntity`, sends a Mailgun email with instructions to POST to `/v1/auth/password-reset`.

- Reset Password:
  - Endpoint: `POST /v1/auth/password-reset`
  - Request Body: `{ token: string; newPassword: string }`
  - Behavior: Validates the reset token, hashes the new password, updates the user's password, deletes the reset record, and returns success.
  - Note: Password reset tokens expire after 15 minutes.

## TODO

- Prevent emails from going to spam: configure your Mailgun domain (add SPF, DKIM, DMARC DNS records), verify the domain in the Mailgun UI, or upgrade to a paid plan / add authorized recipients.
- Frontend: create a page at `/verify-email` (e.g. `FRONTEND_URL/verify-email?token=<token>`) that extracts the `token` query parameter and sends a `POST /v1/auth/verify-email?token=<token>` request to complete the email verification flow.
- Frontend: create a page at `/password-reset` (e.g. `FRONTEND_URL/password-reset?token=<token>`) that extracts the `token` query parameter and allows entering a new password, then sends a `POST /v1/auth/password-reset` request with body `{ "token": token, "newPassword": string }` to complete the password reset flow.
