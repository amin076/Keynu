export type FileSystemAction =
  | "readFile"
  | "writeFile"
  | "createFolder"
  | "listDirectory"
  | "exists";

export type FileSystemRequest = {
  action: FileSystemAction;
  path: string;
  content?: string;
};

export type FileSystemResult = {
  summary: string;
  data?: unknown;
  changed?: string[];
};
