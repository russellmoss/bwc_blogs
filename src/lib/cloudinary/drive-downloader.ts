/**
 * Download an image from Google Drive using the export URL.
 * Works for files shared with "Anyone with the link".
 * Returns a Buffer of the image data.
 */
export async function downloadFromDrive(driveFileId: string): Promise<Buffer> {
  const url = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "BWC-Content-Engine/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`DRIVE_DOWNLOAD_FAILED: HTTP ${response.status} for file ${driveFileId}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
