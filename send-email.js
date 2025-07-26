const { google } = require('googleapis');

async function sendEmail() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_AUTH_SERVICE_ACCOUNT_EMAIL,
    subject: 'info@prizeversity.com', // Impersonated Workspace user
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
  });

  const gmail = google.gmail({ version: 'v1', auth });

  const rawMessage = Buffer.from(
    `From: "Prizeversity" <info@prizeversity.com>\r\n` +
    `To: samaksharora.09@gmail.com\r\n` +
    `Subject: Hello from Prizeversity!\r\n\r\n` +
    `This is a test email sent using Gmail API + Workload Identity Federation.`
  ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawMessage },
  });

  console.log('Email sent successfully!');
}

sendEmail().catch(console.error);