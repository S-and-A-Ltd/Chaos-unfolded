import { set, get, del } from 'idb-keyval';

export async function saveDocumentBlob(id: string, blob: Blob | File): Promise<void> {
  await set(`doc_blob_${id}`, blob);
}

export async function getDocumentBlob(id: string): Promise<Blob | File | undefined> {
  return await get(`doc_blob_${id}`);
}

export async function deleteDocumentBlob(id: string): Promise<void> {
  await del(`doc_blob_${id}`);
  await del(`pdf_annotations_${id}`);
  await del(`pdf_prefs_${id}`);
}

import type { PDFAnnotation, PDFPreferences } from '@/types';

export async function savePDFAnnotations(id: string, annotations: PDFAnnotation[]): Promise<void> {
  await set(`pdf_annotations_${id}`, annotations);
}

export async function getPDFAnnotations(id: string): Promise<PDFAnnotation[] | undefined> {
  return await get(`pdf_annotations_${id}`);
}

export async function savePDFPreferences(id: string, prefs: PDFPreferences): Promise<void> {
  await set(`pdf_prefs_${id}`, prefs);
}

export async function getPDFPreferences(id: string): Promise<PDFPreferences | undefined> {
  return await get(`pdf_prefs_${id}`);
}
