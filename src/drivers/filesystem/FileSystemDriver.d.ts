import { Driver } from "../../core/Driver";
export declare class FileSystemDriver implements Driver {
    readonly id = "filesystem";
    initialize(): Promise<void>;
    execute(command: unknown): Promise<void>;
}
//# sourceMappingURL=FileSystemDriver.d.ts.map