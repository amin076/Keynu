"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverManager = void 0;
const Driver_1 = require("./Driver");
class DriverManager {
    drivers = new Map();
    register(driver) {
        this.drivers.set(driver.id, driver);
        console.log(`Driver registered: ${driver.id}`);
    }
    async initialize() {
        for (const driver of this.drivers.values()) {
            await driver.initialize();
        }
    }
    get(id) {
        return this.drivers.get(id);
    }
}
exports.DriverManager = DriverManager;
//# sourceMappingURL=DriverManager.js.map