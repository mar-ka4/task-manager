import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001', {
    auth: { token },
    transports: ['websocket'],
  });

  return socket;
}

export function subscribeToProject(
  projectId: string,
  callback: (data: { event: string; data: any }) => void
): Socket | null {
  if (!socket) {
    const token = localStorage.getItem('token');
    if (!token) return null;
    connectSocket(token);
  }

  if (!socket) return null;

  socket.emit('subscribe:project', projectId);
  socket.on('task:update', callback);
  socket.on('project:update', callback);

  return socket;
}

export function unsubscribeFromProject(projectId: string) {
  if (socket) {
    socket.emit('unsubscribe:project', projectId);
    socket.off('task:update');
    socket.off('project:update');
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
