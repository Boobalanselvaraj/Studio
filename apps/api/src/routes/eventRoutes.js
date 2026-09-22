const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const taskController = require('../controllers/taskController');
const { requireStudioRole } = require('../middlewares/rbac');

// Events
router.get('/calendar', eventController.getCalendar);
router.get('/', eventController.list);
router.post('/', requireStudioRole(['studio_owner', 'studio_manager']), eventController.create);

// Event Task Templates
router.get('/task-templates', taskController.getTaskTemplates);
router.post('/task-templates', requireStudioRole(['studio_owner', 'studio_manager']), taskController.createTaskTemplate);

router.get('/:id', eventController.getById);
router.patch('/:id', requireStudioRole(['studio_owner', 'studio_manager']), eventController.update);
router.delete('/:id', requireStudioRole(['studio_owner', 'studio_manager']), eventController.delete);
router.post('/:id/status', eventController.updateStatus);
router.get('/:id/history', eventController.getHistory);

// Event Tasks
router.get('/:eventId/tasks', taskController.getEventTasks);
router.post('/:eventId/tasks', taskController.createTask);
router.patch('/tasks/:id', taskController.updateTask);
router.delete('/tasks/:id', taskController.deleteTask);

module.exports = router;
