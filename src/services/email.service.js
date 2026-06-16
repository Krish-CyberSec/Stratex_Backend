const nodemailer = require("nodemailer");
require("dotenv").config()
// Create Transporter
const transporter = nodemailer.createTransport({
    // service: "gmail",
    host: "smtp.ethereal.email",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify Transporter
transporter.verify((error, success) => {
    if (error) {
        console.error(" Email transporter error:", error);
    } else {
        console.log(" Email server is ready to send messages");
    }
});

const sendSetupEmail = async (
    emails,
    fullName,
    setupLink
) => {
    try {
        const fallbackURL = setupLink;

        const info = await transporter.sendMail({
            from: `"Stratex" <${process.env.EMAIL}>`,
            replyTo: process.env.EMAIL,

            bcc: Array.isArray(emails)
                ? emails.join(", ")
                : emails,

            subject: "University Portal Account Setup",

            headers: {
                "X-Application": "Stratex",
                "X-Priority": "3"
            },


            // Plain text fallback
            text: `
Hello ${fullName},

Your Stratex account has been created.

Set your password using the link below:

${setupLink}

If the button does not work, use:

${fallbackURL}

This link expires in 24 hours.

After activation, you will be able to:
• Access your academic dashboard
• View course registrations and records
• Receive department announcements
• Check examination schedules and results

If you did not request this account setup, please ignore this email or contact support.
            `,

            html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>University Portal Account Setup</title>
</head>

<body style="margin:0;background:#eef7fc;font-family:Arial,sans-serif;">

<table width="100%" style="background:#eef7fc;padding:40px 0;">
<tr>
<td align="center">

<table width="600" style="background:#ffffff;border:1px solid #bdd7e8;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(16,35,63,0.08);">

    <!-- TOP BAR -->
    <tr>
        <td>
            <div style="height:6px;background:#0868ad;"></div>
        </td>
    </tr>

    <!-- HEADER -->
    <tr>
        <td style="padding:22px 28px;text-align:center;">

            <div style="font-size:20px;font-weight:bold;color:#0868ad;">
                Stratex
            </div>

            <div style="font-size:12px;color:#60748a;margin-top:4px;">
                Academic Management System • Account Setup
            </div>

        </td>
    </tr>

    <!-- CONTENT -->
    <tr>
        <td style="padding:0 28px;">

            <h2 style="color:#10233f;margin:0;">
                Hello ${fullName},
            </h2>

            <p style="color:#60748a;font-size:14px;line-height:1.6;">
                Your university account has been created. Please set your password to activate your account.
            </p>

            <!-- EXPIRY INFO -->
            <div style="background:#eef7fc;border:1px solid #bdd7e8;border-left:4px solid #0868ad;padding:12px;border-radius:6px;margin:15px 0;">

                <p style="margin:0;font-size:13px;color:#60748a;">
                    ⏳ This link will expire in <b style="color:#0868ad;">24 hours</b> for security reasons.
                </p>

            </div>

        </td>
    </tr>

    <!-- INFO SECTION -->
    <tr>
        <td style="padding:0 28px 10px 28px;">

            <div style="
                background:#eef7fc;
                border:1px solid #bdd7e8;
                border-left:4px solid #0868ad;
                padding:12px;
                border-radius:6px;
            ">

                <p style="
                    margin:0 0 8px 0;
                    font-size:13px;
                    color:#60748a;
                ">
                    After activation, you will be able to:
                </p>

                <ul style="
                    margin:0;
                    padding-left:18px;
                    color:#10233f;
                    font-size:13px;
                    line-height:1.6;
                ">
                    <li>Access your academic dashboard</li>
                    <li>View course registrations and records</li>
                    <li>Receive department announcements</li>
                    <li>Check examination schedules and results</li>
                </ul>

            </div>

        </td>
    </tr>

    <!-- CTA -->
    <tr>
        <td align="center" style="padding:20px 28px;">

            <a href="${setupLink}"
               style="
                    background:#0868ad;
                    color:#ffffff;
                    padding:12px 28px;
                    border-radius:6px;
                    text-decoration:none;
                    font-weight:bold;
                    display:inline-block;
               ">
                Set My Password
            </a>

        </td>
    </tr>

    <!-- FALLBACK LINK -->
    <tr>
        <td style="padding:0 28px 25px 28px;text-align:center;">

            <p style="font-size:12px;color:#60748a;">
                If the button doesn't work, use this link:
            </p>

            <a href="${fallbackURL}"
               style="
                    font-size:12px;
                    color:#0868ad;
                    word-break:break-all;
               ">
                ${fallbackURL}
            </a>

        </td>
    </tr>

    <!-- WARNING -->
    <tr>
        <td style="padding:0 28px 28px 28px;">

            <div style="
                background:#fff5f5;
                border-left:4px solid #ed1c24;
                padding:12px;
                border-radius:6px;
            ">

                <span style="
                    color:#10233f;
                    font-size:13px;
                    line-height:1.5;
                ">
                    If you did not request this account setup, please ignore this email or contact support.
                </span>

            </div>

        </td>
    </tr>

    <!-- FOOTER -->
    <tr>
        <td style="background:#10233f;padding:18px 28px;text-align:center;">

            <div style="
                color:#bdd7e8;
                font-size:12px;
                margin-bottom:6px;
            ">
                Stratex Academic Portal • Secure System
            </div>

            <div style="
                color:#60748a;
                font-size:11px;
            ">
                This is an automated message. Please do not reply to this email.
            </div>

        </td>
    </tr>

</table>

</td>
</tr>
</table>

</body>
</html>
            `
        });

        return info;

    } catch (error) {
        console.error(
            "Failed to send setup email:",
            error
        );

        throw error;
    }
};

module.exports = sendSetupEmail;