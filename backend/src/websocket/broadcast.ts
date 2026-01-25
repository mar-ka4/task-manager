import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export function setIoInstance(io: Server) {
  ioInstance = io;
}

export function broadcastTaskUpdate(
  projectId: string,
  event: string,
  data: any
) {
  if (ioInstance) {
    ioInstance.to(`project:${projectId}`).emit('task:update', { event, data });
  }
}

export function broadcastProjectUpdate(
  projectId: string,
  event: string,
  data: any
) {
  if (ioInstance) {
    ioInstance.to(`project:${projectId}`).emit('project:update', { event, data });
  }
}
