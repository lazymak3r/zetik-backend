import { Global, Module } from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { AppDataSource } from '../data-source';

@Global()
@Module({
  imports: [TypeOrmModule.forRoot(AppDataSource.options)],
  providers: [
    // Alias to make app.get('DataSource') work in tests and elsewhere
    { provide: 'DataSource', useExisting: getDataSourceToken() },
  ],
  exports: [TypeOrmModule, 'DataSource'],
})
export class DatabaseModule {}
