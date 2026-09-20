const eventService = require('../services/events/eventWorkflow.service');
const eventRepo = require('../repositories/event.repository');

class EventController {
  async list(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        eventType: req.query.type,
        fromDate: req.query.from,
        toDate: req.query.to,
      };
      const events = await eventService.listEvents(req.studioId, filters);
      res.json(events);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const eventData = {
        ...req.body,
        created_by: req.user ? req.user.id : null
      };
      const event = await eventService.createEvent(req.studioId, eventData);
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const event = await eventRepo.findById(req.studioId, req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json(event);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { to_status, note } = req.body;
      const updated = await eventService.transitionStatus(
        req.studioId,
        req.params.id,
        to_status,
        req.user ? req.user.id : null,
        note
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  async getHistory(req, res, next) {
    try {
      const history = await eventRepo.getHistory(req.studioId, req.params.id);
      res.json(history);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new EventController();
