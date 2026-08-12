type VerificationEmail = {
  email: string;
  code: string;
};

export class EmailConfigurationError extends Error {
  constructor(message = "Email delivery is not configured.") {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(
    public readonly status: number,
    public readonly providerMessage: string,
  ) {
    super(`Resend request failed with status ${status}: ${providerMessage}`);
    this.name = "EmailDeliveryError";
  }
}

export async function sendVerificationCode({ email, code }: VerificationEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production" && process.env.AUTH_DELIVERY_MODE === "console") {
      console.info(`[setlog auth] verification code for ${email}: ${code}`);
      return;
    }
    throw new EmailConfigurationError();
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Setlog Matchの認証コード",
      text: `Setlog Matchの認証コードは ${code} です。10分以内に入力してください。\n\n心当たりがない場合は、このメールを無視してください。`,
      html: `<p>Setlog Matchの認証コードは<strong>${code}</strong>です。</p><p>10分以内に入力してください。心当たりがない場合は、このメールを無視してください。</p>`,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: unknown } | null;
    const providerMessage = typeof payload?.message === "string"
      ? payload.message.slice(0, 300)
      : "Unknown Resend error";
    throw new EmailDeliveryError(response.status, providerMessage);
  }
}
