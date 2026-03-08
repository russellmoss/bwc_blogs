import { prisma } from "@/lib/db";
import { getAccessToken } from "./drive-auth";
import { chunkMarkdown } from "./chunker";
import { embedTexts } from "./embedder";
import { env } from "@/lib/env";
import type { RagSyncResult } from "@/types/rag";

const SUPPORTED_MIME_TYPES = [
  "text/markdown",
  "text/plain",
  "application/vnd.google-apps.document", // Google Docs — exported as text
];

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum?: string;
  modifiedTime?: string;
  trashed?: boolean;
}

interface DriveChange {
  fileId: string;
  removed: boolean;
  file?: DriveFile;
}

/**
 * Get or initialize the start page token for incremental sync.
 */
async function getStartPageToken(): Promise<string> {
  const db = prisma;
  const state = await db.ragSyncState.findUnique({ where: { id: 1 } });

  if (state?.startPageToken) {
    return state.startPageToken;
  }

  // Initialize: get current page token from Drive
  const token = await getAccessToken();
  const response = await fetch(
    "https://www.googleapis.com/drive/v3/changes/startPageToken",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error(`Failed to get startPageToken: ${response.status}`);
  const data = await response.json();
  const pageToken = data.startPageToken as string;

  await db.ragSyncState.upsert({
    where: { id: 1 },
    create: { id: 1, startPageToken: pageToken },
    update: { startPageToken: pageToken },
  });

  return pageToken;
}

/**
 * Fetch changes from Google Drive since the last sync.
 */
async function fetchDriveChanges(pageToken: string): Promise<{
  changes: DriveChange[];
  newPageToken: string;
}> {
  const token = await getAccessToken();
  const folderId = env.GOOGLE_DRIVE_DOCS_FOLDER_ID;
  const allChanges: DriveChange[] = [];
  let currentToken = pageToken;
  let newStartPageToken = pageToken;

  while (true) {
    const url = new URL("https://www.googleapis.com/drive/v3/changes");
    url.searchParams.set("pageToken", currentToken);
    url.searchParams.set("fields", "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,md5Checksum,modifiedTime,trashed,parents))");
    url.searchParams.set("spaces", "drive");
    url.searchParams.set("includeRemoved", "true");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Drive changes API failed: ${response.status}`);

    const data = await response.json();

    // Filter to only files in our target folder
    for (const change of data.changes ?? []) {
      if (change.removed) {
        allChanges.push({ fileId: change.fileId, removed: true });
        continue;
      }
      const file = change.file;
      if (!file) continue;
      const parents: string[] = file.parents ?? [];
      if (parents.includes(folderId)) {
        allChanges.push({
          fileId: change.fileId,
          removed: file.trashed === true,
          file: {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            md5Checksum: file.md5Checksum,
            modifiedTime: file.modifiedTime,
          },
        });
      }
    }

    if (data.newStartPageToken) {
      newStartPageToken = data.newStartPageToken;
      break;
    }
    if (data.nextPageToken) {
      currentToken = data.nextPageToken;
    } else {
      break;
    }
  }

  return { changes: allChanges, newPageToken: newStartPageToken };
}

/**
 * Download file content from Google Drive.
 */
async function downloadFileContent(fileId: string, mimeType: string): Promise<string> {
  const token = await getAccessToken();

  let url: string;
  if (mimeType === "application/vnd.google-apps.document") {
    // Export Google Docs as plain text
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Failed to download file ${fileId}: ${response.status}`);
  return response.text();
}

/**
 * Index a single file: chunk it, embed chunks, store in database.
 * Uses a transaction so a crash never leaves a document with stale/missing chunks.
 * md5Checksum is written LAST — if we crash before that, the next sync re-indexes.
 */
export async function indexFile(
  driveFile: DriveFile,
  content: string
): Promise<number> {
  const db = prisma;

  const chunks = chunkMarkdown(content);
  if (chunks.length === 0) return 0;

  // Embed all chunks BEFORE the transaction (network call, don't hold tx open)
  const embeddings = await embedTexts(chunks.map((c) => c.content));

  await db.$transaction(async (tx) => {
    // Upsert the document record WITHOUT md5 — so a crash triggers re-index
    const doc = await tx.ragDocument.upsert({
      where: { driveFileId: driveFile.id },
      create: {
        driveFileId: driveFile.id,
        filename: driveFile.name,
        mimeType: driveFile.mimeType,
        md5Checksum: null, // set after chunks succeed
        driveModifiedAt: driveFile.modifiedTime ? new Date(driveFile.modifiedTime) : null,
        charCount: content.length,
        chunkCount: chunks.length,
      },
      update: {
        filename: driveFile.name,
        mimeType: driveFile.mimeType,
        md5Checksum: null, // clear until chunks succeed
        driveModifiedAt: driveFile.modifiedTime ? new Date(driveFile.modifiedTime) : null,
        charCount: content.length,
        chunkCount: chunks.length,
        indexedAt: new Date(),
      },
    });

    // Delete old chunks for this document
    await tx.ragChunk.deleteMany({ where: { documentId: doc.id } });

    // Insert new chunks with embeddings via raw SQL (for vector type)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embeddingStr = `[${embeddings[i].join(",")}]`;

      await tx.$executeRawUnsafe(
        `INSERT INTO rag_chunks (document_id, chunk_index, content, token_count, heading_context, embedding, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())`,
        doc.id,
        i,
        chunk.content,
        chunk.tokenCount,
        chunk.headingContext,
        embeddingStr
      );
    }

    // NOW set md5Checksum — crash before here means next sync re-indexes
    if (driveFile.md5Checksum) {
      await tx.ragDocument.update({
        where: { id: doc.id },
        data: { md5Checksum: driveFile.md5Checksum },
      });
    }
  });

  return chunks.length;
}

/**
 * Run an incremental sync: process only files changed since last sync.
 */
export async function runIncrementalSync(): Promise<RagSyncResult> {
  const startTime = Date.now();
  const db = prisma;
  const errors: string[] = [];
  let filesProcessed = 0;
  let filesDeleted = 0;
  let chunksCreated = 0;

  const pageToken = await getStartPageToken();
  const { changes, newPageToken } = await fetchDriveChanges(pageToken);

  for (const change of changes) {
    try {
      if (change.removed) {
        // Delete document and its chunks (cascade)
        const existing = await db.ragDocument.findUnique({
          where: { driveFileId: change.fileId },
        });
        if (existing) {
          await db.ragDocument.delete({ where: { id: existing.id } });
          filesDeleted++;
        }
        continue;
      }

      const file = change.file!;
      if (!SUPPORTED_MIME_TYPES.includes(file.mimeType)) continue;

      // Check if content has changed via md5 or modifiedTime
      const existing = await db.ragDocument.findUnique({
        where: { driveFileId: file.id },
      });
      if (existing) {
        if (file.md5Checksum && existing.md5Checksum === file.md5Checksum) continue;
        if (!file.md5Checksum && file.modifiedTime && existing.driveModifiedAt) {
          const remoteModified = new Date(file.modifiedTime).getTime();
          const localModified = existing.driveModifiedAt.getTime();
          if (remoteModified <= localModified) continue;
        }
      }

      const content = await downloadFileContent(file.id, file.mimeType);
      const chunks = await indexFile(file, content);
      filesProcessed++;
      chunksCreated += chunks;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${change.fileId}: ${msg}`);
    }
  }

  // Update sync state
  const result: RagSyncResult = {
    filesProcessed,
    filesDeleted,
    chunksCreated,
    errors,
    durationMs: Date.now() - startTime,
  };

  await db.ragSyncState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      startPageToken: newPageToken,
      lastSyncAt: new Date(),
      lastSyncResult: JSON.parse(JSON.stringify(result)),
    },
    update: {
      startPageToken: newPageToken,
      lastSyncAt: new Date(),
      lastSyncResult: JSON.parse(JSON.stringify(result)),
    },
  });

  return result;
}

/**
 * List all files in the docs folder (for initial bulk indexing).
 */
export async function listAllDocsFiles(): Promise<DriveFile[]> {
  const token = await getAccessToken();
  const folderId = env.GOOGLE_DRIVE_DOCS_FOLDER_ID;
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  while (true) {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,md5Checksum,modifiedTime)");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Drive list failed: ${response.status}`);

    const data = await response.json();
    allFiles.push(...(data.files ?? []));

    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  return allFiles;
}
