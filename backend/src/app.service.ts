import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type DependencyStatus = 'ok' | 'down' | 'configured' | 'not_configured';

type HealthResponse = {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  dependencies: {
    database: {
      status: DependencyStatus;
      message?: string;
    };
    knet: {
      status: DependencyStatus;
      missing: string[];
    };
  };
};

const requiredKnetEnv = [
  'MYFATOORAH_API_TOKEN',
  'MYFATOORAH_BASE_URL',
  'MYFATOORAH_CALLBACK_URL',
  'MYFATOORAH_ERROR_URL',
];

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  getHello(): string {
    return 'Meatena Butchery Operations API';
  }

  async getHealth(): Promise<HealthResponse> {
    const database = await this.getDatabaseHealth();
    const missingKnetEnv = requiredKnetEnv.filter((key) => !process.env[key]);

    return {
      status: database.status === 'ok' ? 'ok' : 'degraded',
      service: 'meatena-butchery-operations-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      dependencies: {
        database,
        knet: {
          status: missingKnetEnv.length ? 'not_configured' : 'configured',
          missing: missingKnetEnv,
        },
      },
    };
  }

  private async getDatabaseHealth(): Promise<HealthResponse['dependencies']['database']> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }
}
