import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';

const TENANT_ID = 'tenant-test';

const mockAppointment = {
  id: 'apt-1',
  tenantId: TENANT_ID,
  clientId: 'client-1',
  artistId: 'artist-1',
  date: new Date(),
  durationMinutes: 60,
  status: AppointmentStatus.PENDING,
  description: null,
  bodyPart: null,
  estimatedValue: null,
  deposit: 0,
  notes: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: { name: 'Client Test', phone: '999' },
  artist: { user: { name: 'Artist Test' } },
  sessions: [],
  payments: [],
};

const mockPrisma = {
  appointment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  client: { findFirst: jest.fn() },
  tattooArtist: { findFirst: jest.fn() },
  session: { create: jest.fn(), updateMany: jest.fn() },
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('deve retornar agendamento existente', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      const result = await service.findOne('apt-1', TENANT_ID);
      expect(result).toEqual(mockAppointment);
    });

    it('deve lançar NotFoundException se não encontrar', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);
      await expect(service.findOne('apt-999', TENANT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('deve transicionar PENDING → CONFIRMED', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.appointment.update.mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CONFIRMED });

      const result = await service.updateStatus('apt-1', { status: AppointmentStatus.CONFIRMED }, TENANT_ID);
      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('deve rejeitar transição inválida PENDING → COMPLETED', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      await expect(
        service.updateStatus('apt-1', { status: AppointmentStatus.COMPLETED }, TENANT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve criar sessão ao transicionar para IN_SESSION', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CONFIRMED });
      mockPrisma.appointment.update.mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.IN_SESSION });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-1' });

      await service.updateStatus('apt-1', { status: AppointmentStatus.IN_SESSION }, TENANT_ID);
      expect(mockPrisma.session.create).toHaveBeenCalled();
    });

    it('deve fechar sessão ao COMPLETAR', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.IN_SESSION });
      mockPrisma.appointment.update.mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.COMPLETED });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });

      await service.updateStatus('apt-1', { status: AppointmentStatus.COMPLETED }, TENANT_ID);
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ endedAt: expect.any(Date) }) }),
      );
    });
  });
});
