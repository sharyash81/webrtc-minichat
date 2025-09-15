import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: {
        origin: '*',
    },
})

const users = new Map()

io.on('connection', (socket) => {
    console.log(`A new user connected with socket ID: ${socket.id}`);


    socket.on('ice-candidate', (iceCandidate, targetSocketId) => {
        console.log(
            `Ice candidate received on server to be able to send to ${targetSocketId} `,
            iceCandidate
        );

        io.to(targetSocketId).emit('ice-candidate', iceCandidate, socket.id);
    });
    
    socket.on('offer', (offer, targetSocketId) => {
        console.log(
            `Offer received on server from ${socket.id} to be able to send to ${targetSocketId}`,
            offer
        );

        io.to(targetSocketId).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, targetSocketId) => {
        console.log(
            `Answer received on server to be able to send to ${targetSocketId}`,
            answer
        );

        io.to(targetSocketId).emit('answer', answer, socket.id);
    });

    socket.on('chat-message', (message) => {
        console.log(`Chat message from ${socket.id}: ${message}`);
        socket.broadcast.emit('chat-message', message, socket.id); 
    });

    socket.on('join-call', () => {
        console.log(`${socket.id} joined the call`);
        socket.broadcast.emit('user-connected', socket.id);
    });

    socket.on('disconnect', () => {
        console.log(`${socket.id} disconnected`);
        socket.broadcast.emit('user-disconnected', socket.id);
    });
});


const port = process.env.PORT || 8000

httpServer.listen(port, () => {
    console.log(`Server started on port ${port}`)
})