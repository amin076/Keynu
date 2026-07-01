import { Driver } from "../../core/Driver.js";

export class FileSystemDriver implements Driver {

    readonly id = "filesystem";

    async initialize() {

        console.log("FileSystem Driver Ready");

    }

    async execute(command: unknown) {

        console.log(command);

    }

}