export interface Driver {
    readonly id: string;
    initialize(): Promise<void>;
    execute(command: unknown): Promise<void>;
}
//# sourceMappingURL=Driver.d.ts.map