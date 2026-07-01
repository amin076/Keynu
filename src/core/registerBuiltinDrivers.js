"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBuiltinDrivers = registerBuiltinDrivers;
const DriverManager_1 = require("./DriverManager");
const FileSystemDriver_1 = require("../drivers/filesystem/FileSystemDriver");
async function registerBuiltinDrivers(manager) {
    manager.register(new FileSystemDriver_1.FileSystemDriver());
    await manager.initialize();
}
//# sourceMappingURL=registerBuiltinDrivers.js.map