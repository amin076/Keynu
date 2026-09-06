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

export type FileSystemResultData = {
  content?: string;
  entries?: string[];
  exists?: boolean;
};

export type FileSystemResult = {
  summary: string;
  data?: FileSystemResultData;
  changed?: string[];
};
