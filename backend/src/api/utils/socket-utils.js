// socket-utils.js

let ioInstance;

/**
 * Initializes the Socket.IO instance for use across the application.
 * This MUST be called immediately after the Socket.IO server is created in server.js.
 * @param {object} io The Socket.IO Server instance.
 */
const initSocketIO = (io) => {
    ioInstance = io;
};

/**
 * Sends an instant notification event to a specific user ID via their private room.
 * This triggers the client's fetchUnreadCount() function.
 * @param {number} recipientId The ID of the user to notify.
 */
const sendNotificationToUser = (recipientId) => {
    if (!ioInstance) {
        console.error('Socket.IO instance not initialized in socket-utils.');
        return;
    }
    
    // We use the room name 'user-{recipientId}' which is created in server.js's 'register_user' event.
    const userRoom = `user-${recipientId}`;
    
    // 'new_notification_received' is the event the client's SocketContext is listening for.
    ioInstance.to(userRoom).emit('new_notification_received');
    
    // console.log(`INSTANT NOTIFICATION: Emitted 'new_notification_received' to room ${userRoom}`);
};

module.exports = { initSocketIO, sendNotificationToUser };
