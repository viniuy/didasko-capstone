import { Resend } from "resend";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends an email using Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("[Email] RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    const { data, error } = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Didasko System <noreply@didasko.local>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Failed to send email:", error);
      return { success: false, error: error.message };
    }

    console.log("[Email] Email sent successfully:", data?.id);
    return { success: true };
  } catch (error: any) {
    console.error("[Email] Error sending email:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

/**
 * Sends break-glass activation code email to Academic Head
 */
export async function sendBreakGlassCodeEmail({
  to,
  facultyName,
  promotionCode,
}: {
  to: string;
  facultyName: string;
  promotionCode: string;
}): Promise<{ success: boolean; error?: string }> {
  const subject = "Break-Glass Activation: Promotion Code Required";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #124A69;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-radius: 0 0 5px 5px;
          }
          .code-box {
            background-color: #fff;
            border: 2px solid #124A69;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
            font-family: 'Courier New', monospace;
            font-size: 18px;
            font-weight: bold;
            color: #124A69;
            letter-spacing: 2px;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Break-Glass Activation Code</h1>
        </div>
        <div class="content">
          <p>Dear Academic Head,</p>
          
          <p>You have successfully activated the break-glass override system and temporarily promoted <strong>${facultyName}</strong> to Admin role.</p>
          
          <div class="warning">
            <strong>⚠️ Important:</strong> This code is required to permanently promote the temporary admin. Keep this code secure and do not share it with unauthorized personnel.
          </div>
          
          <p>To permanently promote this temporary admin to a permanent Admin role, a permanent Admin must use the following promotion code:</p>
          
          <div class="code-box">
            ${promotionCode}
          </div>
          
          <p><strong>Instructions for Permanent Promotion:</strong></p>
          <ol>
            <li>A permanent Admin must access the user management system</li>
            <li>Locate the temporary admin user (${facultyName})</li>
            <li>Click the "Promote to Permanent Admin" button</li>
            <li>Enter the promotion code shown above</li>
            <li>Confirm the promotion</li>
          </ol>
          
          <div class="warning">
            <strong>Security Note:</strong> This code is encrypted and can only be used once. If you lose this code, you will need to deactivate the break-glass session and create a new one.
          </div>
          
          <p>If you did not initiate this action, please contact the system administrator immediately.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from the Didasko System.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </body>
    </html>
  `;

  return await sendEmail({ to, subject, html });
}
