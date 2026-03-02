"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../hooks/shared/env");
const db_path_1 = require("../memory/db-path");
const store_1 = require("../memory/store");
function main() {
    const config = (0, env_1.getMemoryEnvConfig)();
    const dbPath = (0, db_path_1.resolveMemoryDbPath)(config.dbPath, process.cwd());
    const store = new store_1.SqliteMemoryStore(dbPath);
    store.close();
    process.stdout.write(`Migrations are up-to-date for ${dbPath}\n`);
}
main();
