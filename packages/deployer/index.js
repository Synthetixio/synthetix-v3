const fs = require('fs');
const path = require('path');

// Require all code within
// tasks/
['tasks', 'subtasks', 'extensions'].forEach((folder) =>
  fs
    .readdirSync(path.join(__dirname, folder))
    .forEach((mod) => require(path.join(__dirname, folder, mod)))
);
