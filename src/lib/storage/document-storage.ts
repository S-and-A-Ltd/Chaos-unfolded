import { set, get, del } from 'idb-keyval';

export async function saveDocumentBlob(id: string, blob: Blob | File): Promise<void> {
  await set(`doc_blob_${id}`, blob);
}

export async function getDocumentBlob(id: string): Promise<Blob | File | undefined> {
  return await get(`doc_blob_${id}`);
}

export async function deleteDocumentBlob(id: string): Promise<void> {
  await del(`doc_blob_${id}`);
}
