const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const taskController = require('../controllers/task.controller');
const { requireStudioRole } = require('../middlewares/rbac');

// Events
router.get('/', eventController.list);
router.post('/', requireStudioRole(['studio_owner', 'studio_manager']), eventController.create);
router.get('/:id', eventController.getById);
router.post('/:id/status', eventController.updateStatus);
router.get('/:id/history', eventController.getHistory);

// Event Tasks
router.get('/:eventId/tasks', taskController.getEventTasks);
router.post('/:eventId/tasks', taskController.createTask);

module.exports = router;
