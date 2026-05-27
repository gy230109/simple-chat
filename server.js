const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = new Map();

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log(`客户端 ${socket.id} 已连接`);

    socket.on('create-room', () => {
        const roomId = uuidv4().slice(0, 8);
        rooms.set(roomId, {
            participants: new Set([socket.id]),
            messages: []
        });
        socket.join(roomId);
        socket.emit('room-created', { roomId });
        console.log(`房间 ${roomId} 已创建`);
    });

    socket.on('join-room', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            if (room.participants.size < 2) {
                room.participants.add(socket.id);
                socket.join(roomId);
                socket.emit('joined-room', { roomId, messages: room.messages });
                socket.to(roomId).emit('peer-joined', { peerId: socket.id });
                console.log(`客户端 ${socket.id} 加入房间 ${roomId}`);
            } else {
                socket.emit('room-full', { roomId });
            }
        } else {
            socket.emit('room-not-found', { roomId });
        }
    });

    socket.on('send-message', ({ roomId, message }) => {
        const room = rooms.get(roomId);
        if (room) {
            const messageData = {
                senderId: socket.id,
                content: message,
                timestamp: new Date().toISOString()
            };
            room.messages.push(messageData);
            io.to(roomId).emit('receive-message', messageData);
            console.log(`消息: ${socket.id} -> ${roomId}: ${message}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`客户端 ${socket.id} 已断开`);
        for (const [roomId, room] of rooms) {
            if (room.participants.has(socket.id)) {
                room.participants.delete(socket.id);
                socket.to(roomId).emit('peer-left', { peerId: socket.id });
                if (room.participants.size === 0) {
                    rooms.delete(roomId);
                    console.log(`房间 ${roomId} 已销毁`);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log('='.repeat(60));
    console.log('🌐 跨网聊天服务器已启动 (服务器转发模式)');
    console.log('='.repeat(60));
    console.log(`📱 本机访问: http://localhost:${PORT}`);
    console.log(`🌐 外网访问: http://<你的公网IP>:${PORT}`);
    console.log('');
    console.log('✨ 功能特点:');
    console.log('  • 支持不同网络环境（移动数据、不同WiFi）');
    console.log('  • 使用服务器转发，无需复杂网络穿透');
    console.log('  • 生成8位房间码，方便分享');
    console.log('  • 消息历史自动保存');
    console.log('='.repeat(60));
});