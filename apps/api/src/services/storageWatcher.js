const { EventEmitter } = require('events');
const storageEvents = new EventEmitter();
storageEvents.setMaxListeners(200);
// Unmapped filesystem discovery cannot establish tenant ownership or an upload commit.
// Managed upload sessions emit scoped events after a durable database commit.
function startStorageWatcher() {}
module.exports = { storageEvents, startStorageWatcher };
