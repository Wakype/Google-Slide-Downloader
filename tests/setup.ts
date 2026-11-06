import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";

globalThis.Blob = NodeBlob as unknown as typeof Blob;
