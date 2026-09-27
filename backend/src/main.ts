import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

    app.use(cookieParser());
    
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://192.168.1.7:5173',
      'http://localhost:5174',
      'http://192.168.1.7:5174',
    ],
    credentials: true,
  });

  // di dalam bootstrap() main.ts
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));


  const config = new DocumentBuilder()
    .setTitle('Tani Siaga API')
    .setDescription('Tani Siaga API untuk membantu ketahanan pangan serta menurunkan persentase gagal panen')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addSecurityRequirements('access-token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = 3000;
  await app.listen(port, '0.0.0.0');
  logger.log('Tani Siaga API running on http://localhost:' + port + ' (Swagger: /api)');
  logger.log('Frontend CORS origin: http://localhost:5173');

  const publicTunnel = process.env.PUBLIC_TUNNEL_URL?.replace(/\/$/, '') || '';
  if (publicTunnel) {
    logger.log('═══════════════════════════════════════════════════════════');
    logger.log('PUBLIC TUNNEL DETECTED (PUBLIC_TUNNEL_URL):');
    logger.log('  Tunnel Base URL         : ' + publicTunnel);
    logger.log('  ⚠️  COPY INI KE MIDTRANS DASHBOARD → Settings → Configuration → Payment Notification URL/Webhook URL:');
    logger.log('     Webhook URL #1 : ' + publicTunnel + '/orders/webhook');
    logger.log('     Webhook URL #2 : ' + publicTunnel + '/order/webhook  (alias, sama saja)');
    logger.log('═══════════════════════════════════════════════════════════');
  } else {
    logger.warn('PUBLIC_TUNNEL_URL tidak diatur di .env (Opsional)');
    logger.warn('BUTUH 2 TERMINAL: Jalankan tunnel di terminal BARU:');
    logger.warn('  Terminal 1: npm run start:dev   (NestJS, ini sudah jalan)');
    logger.warn('  Terminal 2: npm run tunnel      (ngrok http 3000)');
    logger.warn('Setelah tunnel jalan, copy URL "Forwarding" https://....ngrok-free.app yang muncul.');
    logger.warn('Paste ke Midtrans Dashboard → Settings → Payment Notification URL:');
    logger.warn('  https://<NGROK_URL_KAMU>/order/webhook');
    logger.warn('(Opsional) Copy URL tersebut ke .env: PUBLIC_TUNNEL_URL=https://....ngrok-free.app lalu restart NestJS');
  }

  const isMidtransProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  logger.log('Midtrans Environment: ' + (isMidtransProduction ? 'PRODUCTION' : 'SANDBOX') + ' (isProduction=' + isMidtransProduction + ')');
  if (!isMidtransProduction) {
    logger.log('Midtrans Sandbox Dashboard: https://dashboard.sandbox.midtrans.com/settings/config_info');
  } else {
    logger.log('Midtrans Production Dashboard: https://dashboard.midtrans.com/settings/config_info');
  }
}

bootstrap();
