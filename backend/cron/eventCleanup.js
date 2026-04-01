const cron = require('node-cron');
const Event = require('../models/Event');
const Message = require('../models/Message');
const state = require('../sockets/state');

// This function will be called during server start
function initCleanupJob(io) {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      // Find events that are currently active but their end time has passed
      // We use the UTC Date.now() representation which is natively supported 
      // by the server's JS runtime since time is normalized on save.
      const now = new Date();
      const expiredEvents = await Event.find({
        isActive: true,
        endTime: { $lte: now }
      });

      if (expiredEvents.length === 0) return;

      console.log(`[Cron] Found ${expiredEvents.length} expired event(s). Running cleanup...`);

      for (const event of expiredEvents) {
        // 1. Mark as inactive
        event.isActive = false;
        await event.save();

        // 2. Permanently delete all messages associated with this event
        const deleteResult = await Message.deleteMany({ eventId: event._id });
        console.log(`[Cron] Deleted ${deleteResult.deletedCount} messages for event ${event._id}`);

        // 3. Emit shutdown sequence to sockets
        if (io) {
          const shutdownMessage = 'This event has concluded. Live interaction is now disabled.';
          
          for (const section of event.sections) {
            const roomName = `${event._id}_${section}`;
            io.to(roomName).emit('event_deactivated', { message: shutdownMessage });
          }
          
          // Forcefully disconnect the attendee sockets mapped to this event constraint
          const sockets = await io.fetchSockets();
          for (const socket of sockets) {
            if (socket.eventId === event._id.toString()) {
              socket.disconnect(true);
            }
          }
          
          // Notify organizers currently watching the event
          for (const [sid, eid] of Object.entries(state.organizerWatching || {})) {
            if (eid === event._id.toString()) {
              io.to(sid).emit('event_deactivated_alert', { message: shutdownMessage, eventId: eid });
            }
          }
        }
      }
    } catch (err) {
      console.error('[Cron] Error during event cleanup:', err.message);
    }
  });

  console.log('🕰️  Cron jobs initialized: Event Cleanup (Every Minute)');
}

module.exports = { initCleanupJob };
