import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { billingEntities } from '../database/entities';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: billingEntities,
  synchronize: true,
});

async function run() {
  await AppDataSource.initialize();
  console.log(`Initialized schema for database "${process.env.DB_NAME}"`);
  await AppDataSource.destroy();
}

run().catch(async (error) => {
  console.error('Database initialization failed:', error);

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  process.exit(1);
});
