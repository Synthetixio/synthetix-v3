const fs = require('fs');
const path = require('path');

// Forces "use strict" on all modules.
require('use-strict');

// Loads all plugin files.
['tasks', 'subtasks', 'extensions'].forEach((folder) =>
  fs
    .readdirSync(path.join(__dirname, folder))
    .forEach((mod) => require(path.join(__dirname, folder, mod)))
);
