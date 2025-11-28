import { ApiProperty } from '@nestjs/swagger';
import { KenoRiskLevel } from '@zetik/shared-entities';

export class KenoConfigResponseDto {
  @ApiProperty({
    description: 'Available risk levels in the game',
    type: [String],
    enum: KenoRiskLevel,
    example: [KenoRiskLevel.CLASSIC, KenoRiskLevel.LOW, KenoRiskLevel.MEDIUM, KenoRiskLevel.HIGH],
    enumName: 'KenoRiskLevel',
  })
  riskLevels!: KenoRiskLevel[];

  @ApiProperty({
    description: `
      Complete multiplier tables for each risk level.
      
      **Structure:**
      - First level key: Risk level (CLASSIC, LOW, MEDIUM, HIGH)
      - Second level key: Number of selected numbers (1-10)
      - Value: Array of multipliers indexed by number of matches
      
      **Example Usage:**
      - To get multiplier for CLASSIC risk, 5 selected numbers, 3 matches:
        multiplierTables.CLASSIC[5][3] = "4.10"
      
      **Risk Level Characteristics:**
      - **CLASSIC**: Balanced payouts with moderate risk
      - **LOW**: Conservative risk, frequent smaller payouts, some payouts for 0 matches
      - **MEDIUM**: Moderate risk with good jackpots potential  
      - **HIGH**: High risk, extreme jackpots (up to 1000x), many combinations return 0
    `,
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
    example: {
      CLASSIC: {
        1: ['0.00', '3.96'],
        2: ['0.00', '1.90', '4.50'],
        3: ['0.00', '1.00', '3.10', '10.40'],
        5: ['0.00', '0.25', '1.40', '4.10', '16.50', '36.00'],
      },
      LOW: {
        1: ['0.70', '1.85'],
        2: ['0.00', '2.00', '3.80'],
        5: ['0.00', '0.00', '1.50', '4.20', '13.00', '300.0'],
      },
      MEDIUM: {
        1: ['0.40', '2.75'],
        5: ['0.00', '0.00', '1.40', '4.00', '14.00', '390.0'],
      },
      HIGH: {
        1: ['0.00', '3.96'],
        5: ['0.00', '0.00', '0.00', '4.50', '48.00', '450.0'],
      },
    },
  })
  multiplierTables!: Record<KenoRiskLevel, Record<number, string[]>>;

  @ApiProperty({
    description: 'Dynamic game configuration settings',
    type: 'object',
    additionalProperties: true,
  })
  gameConfig?: {
    settings: any;
    houseEdge: number;
  };
}
