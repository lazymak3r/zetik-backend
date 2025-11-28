import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKenoToHouseEdge1760089924480 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO games.house_edge (game, edge)
      VALUES ('keno', 1.00)
      ON CONFLICT (game) DO UPDATE SET edge = EXCLUDED.edge
    `);
  }

  public async down(): Promise<void> {}
}
