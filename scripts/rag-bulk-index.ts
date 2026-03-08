/**
 * One-time bulk indexing script for all Drive docs.
 * Run locally: npx tsx scripts/rag-bulk-index.ts
 *
 * This indexes all ~200 markdown files from the Google Drive docs folder.
 * Subsequent updates are handled by the incremental sync (/api/rag/sync).
 */

import { PrismaClient } from "@prisma/client";
import { listAllDocsFiles, indexFile } from "../src/lib/rag/drive-sync";
import { getAccessToken } from "../src/lib/rag/drive-auth";

const SUPPORTED_MIME_TYPES = [
  "text/markdown",
  "text/plain",
  "application/vnd.google-apps.document",
];

async function downloadFileContent(fileId: string, mimeType: string): Promise<string> {
  const token = await getAccessToken();

  let url: string;
  if (mimeType === "application/vnd.google-apps.document") {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Download failed for ${fileId}: ${response.status}`);
  return response.text();
}

async function main() {
  console.log("=== RAG Bulk Index ===\n");

  const prisma = new PrismaClient();

  try {
    // Verify pgvector extension
    await prisma.$executeRawUnsafe("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
    console.log("pgvector extension: OK\n");
  } catch {
    console.error("ERROR: pgvector extension not found. Run the Prisma migration first.");
    process.exit(1);
  }

  console.log("Listing files from Google Drive...");
  const allFiles = await listAllDocsFiles();
  const supportedFiles = allFiles.filter((f) => SUPPORTED_MIME_TYPES.includes(f.mimeType));
  console.log(`Found ${allFiles.length} total files, ${supportedFiles.length} supported\n`);

  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  let totalChunks = 0;

  for (let i = 0; i < supportedFiles.length; i++) {
    const file = supportedFiles[i];
    const progress = `[${i + 1}/${supportedFiles.length}]`;

    try {
      // Check if already indexed with same md5
      if (file.md5Checksum) {
        const existing = await prisma.ragDocument.findUnique({
          where: { driveFileId: file.id },
        });
        if (existing?.md5Checksum === file.md5Checksum) {
          console.log(`${progress} SKIP (unchanged): ${file.name}`);
          skipped++;
          continue;
        }
      }

      const content = await downloadFileContent(file.id, file.mimeType);
      if (!content.trim()) {
        console.log(`${progress} SKIP (empty): ${file.name}`);
        skipped++;
        continue;
      }

      const chunks = await indexFile(
        {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          md5Checksum: file.md5Checksum,
          modifiedTime: file.modifiedTime,
        },
        content
      );

      totalChunks += chunks;
      indexed++;
      console.log(`${progress} OK (${chunks} chunks): ${file.name}`);
    } catch (error) {
      errors++;
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${progress} ERROR: ${file.name} — ${msg}`);
    }
  }

  // Initialize sync state page token
  console.log("\nInitializing sync state page token...");
  const token = await getAccessToken();
  const response = await fetch(
    "https://www.googleapis.com/drive/v3/changes/startPageToken",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (response.ok) {
    const data = await response.json();
    await prisma.ragSyncState.upsert({
      where: { id: 1 },
      create: { id: 1, startPageToken: data.startPageToken, lastSyncAt: new Date() },
      update: { startPageToken: data.startPageToken, lastSyncAt: new Date() },
    });
    console.log(`Sync state initialized with page token: ${data.startPageToken}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Indexed: ${indexed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors:  ${errors}`);
  console.log(`Total chunks: ${totalChunks}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
