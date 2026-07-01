"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const DriverManager_1 = require("./DriverManager");
const registerBuiltinDrivers_1 = require("./registerBuiltinDrivers");
class Agent {
    driverManager = new DriverManager_1.DriverManager();
    async start() {
        console.log("");
        console.log("======================");
        console.log("Keynu");
        console.log("======================");
        console.log("");
        await (0, registerBuiltinDrivers_1.registerBuiltinDrivers)(this.driverManager);
        console.log("");
        console.log("Keynu Ready");
        console.log("");
    }
}
exports.Agent = Agent;
//# sourceMappingURL=Agent.js.map