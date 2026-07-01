import { Driver } from "./Driver.js";

export class DriverManager {

    private readonly drivers = new Map<string, Driver>();

    register(driver: Driver) {

        this.drivers.set(driver.id, driver);

        console.log(`Driver registered: ${driver.id}`);

    }

    async initialize() {

        for (const driver of this.drivers.values()) {

            await driver.initialize();

        }

    }

    get(id: string) {

        return this.drivers.get(id);

    }

}