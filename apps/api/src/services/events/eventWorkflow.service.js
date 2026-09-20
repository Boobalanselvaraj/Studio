const eventRepo = require('../../repositories/event.repository');
const { publishToQueue } = require('../../config/rabbitmq');

const VALID_STATUS_TRANSITIONS = {
  lead: ['booked', 'cancelled'],
  booked: ['scheduled', 'cancelled'],
  scheduled: ['shooting', 'cancelled'],
  shooting: ['editing', 'cancelled'],
  editing: ['review', 'cancelled'],
  review: ['delivered', 'editing', 'cancelled'],
  delivered: ['archived'],
  archived: [],
  cancelled: ['lead', 'booked']
};

class EventWorkflowService {
  async listEvents(studioId, filters) {
    return eventRepo.findFiltered(studioId, filters);
  }

  async createEvent(studioId, eventData) {
    const event = await eventRepo.create(studioId, eventData);
    
    // Auto-create initial history
    await eventRepo.updateStatus(studioId, event.id, event.status, eventData.created_by, 'Initial creation');

    // Notify queue
    await publishToQueue('event-automation', {
      action: 'event_created',
      studioId,
      eventId: event.id
    });

    return event;
  }

  async transitionStatus(studioId, eventId, toStatus, userId, note) {
    const current = await eventRepo.findById(studioId, eventId);
    if (!current) {
      throw new Error('Event not found');
    }

    const allowed = VALID_STATUS_TRANSITIONS[current.status] || [];
    if (!allowed.includes(toStatus)) {
      throw new Error(`Invalid status transition from '${current.status}' to '${toStatus}'`);
    }

    const updated = await eventRepo.updateStatus(studioId, eventId, toStatus, userId, note);

    // Publish event transition job
    await publishToQueue('event-automation', {
      action: 'status_changed',
      studioId,
      eventId,
      fromStatus: current.status,
      toStatus,
      userId
    });

    return updated;
  }
}

module.exports = new EventWorkflowService();
