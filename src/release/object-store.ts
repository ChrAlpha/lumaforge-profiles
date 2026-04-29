export interface PutObjectInput {
  key: string;
  bodyPath: string;
  contentType: string;
  cacheControl: string;
}

export interface ListedObject {
  key: string;
  size: number;
}

export interface ObjectStore {
  headObject(key: string): Promise<boolean>;
  putObject(input: PutObjectInput): Promise<void>;
  listObjects(prefix: string): Promise<ListedObject[]>;
  getJson<T>(key: string): Promise<T | null>;
  deleteObjects(keys: string[]): Promise<void>;
}
