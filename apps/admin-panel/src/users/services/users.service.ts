import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

export interface IUserEntity {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  registrationStrategy: string;
  isBanned: boolean;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  private userRepository: Repository<IUserEntity>;

  constructor(@InjectDataSource() private dataSource: DataSource) {
    // Create repository for users table from users schema
    this.userRepository = this.dataSource.getRepository('users');
  }

  async findAll(limit = 50, offset = 0): Promise<IUserEntity[]> {
    return this.userRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      select: [
        'id',
        'username',
        'displayName',
        'avatarUrl',
        'registrationStrategy',
        'isBanned',
        'isPrivate',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async findById(id: string): Promise<IUserEntity> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'username',
        'displayName',
        'avatarUrl',
        'registrationStrategy',
        'isBanned',
        'isPrivate',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findBannedUsers(limit = 50, offset = 0): Promise<IUserEntity[]> {
    return this.userRepository.find({
      where: { isBanned: true },
      order: { updatedAt: 'DESC' },
      take: limit,
      skip: offset,
      select: [
        'id',
        'username',
        'displayName',
        'avatarUrl',
        'registrationStrategy',
        'isBanned',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async banUser(id: string): Promise<IUserEntity> {
    const user = await this.findById(id);

    if (user.isBanned) {
      throw new Error('User is already banned');
    }

    await this.userRepository.update(id, { isBanned: true });
    return this.findById(id);
  }

  async unbanUser(id: string): Promise<IUserEntity> {
    const user = await this.findById(id);

    if (!user.isBanned) {
      throw new Error('User is not banned');
    }

    await this.userRepository.update(id, { isBanned: false });
    return this.findById(id);
  }

  async getUsersCount(): Promise<{ total: number; banned: number; active: number }> {
    const total = await this.userRepository.count();
    const banned = await this.userRepository.count({ where: { isBanned: true } });

    return {
      total,
      banned,
      active: total - banned,
    };
  }
}
