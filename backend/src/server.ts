import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import projectsRoutes from './routes/projects';
import tasksRoutes from './routes/tasks';
import profilesRoutes from './routes/profiles';
import membersRoutes from './routes/members';
import taskContentRoutes from './routes/task-content';
import taskConnectionsRoutes from './routes/task-connections';
import { setIoInstance } from './websocket/broadcast';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Настройка CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Экспорт io для использования в routes
export { io };

// Установка io instance для broadcast функций
setIoInstance(io);

// Middleware
app.use(cors());
// Увеличиваем лимит размера тела запроса для поддержки больших base64 изображений и файлов
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Task Manager API is running',
    version: '1.0.0'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api', tasksRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api', membersRoutes);
app.use('/api', taskContentRoutes);
app.use('/api', taskConnectionsRoutes);

// WebSocket подключения
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  // Простая проверка наличия токена (можно расширить проверкой JWT)
  socket.data.token = token;
  next();
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('subscribe:project', (projectId: string) => {
    socket.join(`project:${projectId}`);
    console.log(`User ${socket.id} subscribed to project ${projectId}`);
  });

  socket.on('unsubscribe:project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
    console.log(`User ${socket.id} unsubscribed from project ${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});


const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
