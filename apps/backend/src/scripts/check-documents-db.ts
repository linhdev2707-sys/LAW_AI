import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  console.log('Connecting to database...');
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5433', 10),
    user: process.env.DATABASE_USER || 'lawai',
    password: process.env.DATABASE_PASSWORD || 'lawai_password',
    database: process.env.DATABASE_NAME || 'law_ai',
  });
  await client.connect();
  console.log('Connected. Running query...');
  try {
    const res = await client.query(`
      SELECT id, name, status, created_at
      FROM rag_documents
      LIMIT 10
    `);
    console.log('Query completed successfully:');
    console.log(res.rows);
  } catch (e) {
    console.error('Query failed:', e);
  } finally {
    await client.end();
  }
}

main();
