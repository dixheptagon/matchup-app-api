import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { EnvConfigService } from './config/env/env.service.js';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(EnvConfigService);
  const port = configService.get("PORT");
  await app.listen(port ?? 8000);

  if(configService.isDevelopment) {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  } else {
    console.log(`🚀 Application is running on [ENV: ${configService.get('NODE_ENV')}]`);
  }
}
await bootstrap();
