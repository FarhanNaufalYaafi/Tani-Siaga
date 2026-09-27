import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationCode(email: string, code: string, purpose: string): Promise<void> {
    const host = process.env.SMTP_HOST;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!host || !from) {
      throw new ServiceUnavailableException('Pengiriman email belum dikonfigurasi.');
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const purposeLabel = purpose === 'signup'
      ? 'verifikasi email'
      : purpose === 'reset_password'
        ? 'reset password'
        : 'perubahan password';
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      ...(process.env.SMTP_USER && process.env.SMTP_PASS
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {}),
    });

    const result = await transporter.sendMail({
      from,
      replyTo: from,
      to: email,
      subject: `[Tani Siaga] Kode ${purposeLabel}`,
      text: `Tani Siaga\n\nKode ${purposeLabel} Anda: ${code}\n\nKode ini berlaku selama 3 menit, hanya untuk email dan proses ini, serta hanya dapat digunakan satu kali.\n\nJika Anda tidak meminta kode ini, abaikan email ini.`,
      html: `<div style="font-family:Arial,sans-serif;color:#183126;max-width:520px;margin:auto;padding:24px"><p style="color:#39754b;font-size:12px;font-weight:bold;letter-spacing:2px">TANI SIAGA</p><h1 style="font-size:24px">Kode ${purposeLabel}</h1><p>Gunakan kode ini untuk melanjutkan:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#39754b">${code}</p><p>Kode berlaku selama <strong>3 menit</strong>, hanya untuk email dan proses ini, serta hanya dapat digunakan satu kali.</p><p style="color:#718077;font-size:13px">Jika Anda tidak meminta kode ini, abaikan email ini.</p></div>`,
    });

    if (!result.accepted.some((address) => address.toLowerCase() === email.toLowerCase())) {
      this.logger.error(`SMTP tidak menerima penerima verifikasi. Rejected recipients: ${result.rejected.length}`);
      throw new ServiceUnavailableException('Server email menolak alamat penerima.');
    }
    this.logger.log(`SMTP menerima email verifikasi (messageId=${result.messageId}). Penerimaan SMTP tidak menjamin Inbox; Gmail masih dapat mengategorikan email.`);
  }
}