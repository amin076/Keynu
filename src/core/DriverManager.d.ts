import { Driver } from "./Driver";
export declare class DriverManager {
    private readonly drivers;
    register(driver: Driver): void;
    initialize(): Promise<void>;
    get(id: string): Driver | undefined;
}
//# sourceMappingURL=DriverManager.d.ts.map