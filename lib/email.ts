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

export async function sendVerificationCode({ email, code }: VerificationEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production" && process.env.AUTH_DELIVERY_MODE === "console") {
      console.info(`[set-mob auth] verification code for ${email}: ${code}`);
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
      subject: "set-mobの認証コード",
      text: `set-mobの認証コードは ${code} です。10分以内に入力してください。\n\n心当たりがない場合は、このメールを無視してください。`,
      html: `<p>set-mobの認証コードは<strong>${code}</strong>です。</p><p>10分以内に入力してください。心当たりがない場合は、このメールを無視してください。</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend request failed with status ${response.status}.`);
  }
}
