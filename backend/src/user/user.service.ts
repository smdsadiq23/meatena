import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultAdmin();
  }

  async findByUsername(username: string, includePassword = false) {
    const query = this.repo
      .createQueryBuilder('user')
      .where('user.username = :username', { username });

    if (includePassword) {
      query.addSelect('user.password');
    }

    return query.getOne();
  }

  async findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: CreateUserDto) {
    const existingUser = await this.findByUsername(data.username);

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    if (!data.password || data.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const password = await bcrypt.hash(data.password, 10);
    const user = this.repo.create({
      username: data.username.trim(),
      password,
      role: data.role,
    });

    const savedUser = await this.repo.save(user);
    return this.sanitizeUser(savedUser);
  }

  async findAll() {
    const users = await this.repo.find({ order: { id: 'ASC' } });
    return users.map((user) => this.sanitizeUser(user));
  }

  sanitizeUser(user: User | null): Omit<User, 'password'> | null {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  }

  private async ensureDefaultAdmin() {
    const username = process.env.AUTH_DEFAULT_ADMIN_USERNAME ?? 'admin';
    const existingAdmin = await this.findByUsername(username);

    if (existingAdmin) {
      return;
    }

    await this.create({
      username,
      password: process.env.AUTH_DEFAULT_ADMIN_PASSWORD ?? 'admin123',
      role: UserRole.Admin,
    });

    this.logger.log(`Created default admin user "${username}"`);
  }
}
