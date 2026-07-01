"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemDriver = void 0;
const Driver_1 = require("../../core/Driver");
class FileSystemDriver {
    id = "filesystem";
    async initialize() {
        console.log("FileSystem Driver Ready");
    }
    async execute(command) {
        console.log(command);
    }
}
exports.FileSystemDriver = FileSystemDriver;
//# sourceMappingURL=FileSystemDriver.js.map