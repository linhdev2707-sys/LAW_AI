import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedAdminUser1700000014000 implements MigrationInterface {
  name = 'SeedAdminUser1700000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT id FROM "users" WHERE "email" = 'admin@law.com'`,
    );
    if (!existing || existing.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin@123456', 12);
      await queryRunner.query(
        `INSERT INTO "users" (
          "email", "password", "full_name", "role", "is_active", "email_verified", "subscription_plan"
        ) VALUES (
          $1, $2, $3, 'admin', true, true, 'premium'
        )`,
        ['admin@law.com', hashedPassword, 'Administrator'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users" WHERE "email" = 'admin@law.com'`);
  }
}
