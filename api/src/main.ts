import 'reflect-metadata';
import { ArgumentsHost, BadRequestException, Catch, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseExceptionFilter, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

@Catch(BadRequestException)
class ValidationErrorFilter extends BaseExceptionFilter<BadRequestException> {
  override catch(_error: BadRequestException, host: ArgumentsHost) {
    super.catch(new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload.',
    }), host);
  }
}

export async function createApp(options: { logger?: false } = {}) {
  const app = await NestFactory.create(AppModule, options);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ValidationErrorFilter(app.getHttpAdapter()));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Affiliate Marketing Platform API')
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  return app;
}

async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT', '3000'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  await app.listen(port);
}

if (require.main === module) {
  void bootstrap();
}
