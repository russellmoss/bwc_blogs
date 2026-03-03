import { getCloudinaryClient } from "./client";

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export async function uploadToCloudinary(
  buffer: Buffer,
  options: {
    publicId: string;
    folder?: string;
    overwrite?: boolean;
  }
): Promise<CloudinaryUploadResult> {
  const cld = getCloudinaryClient();

  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        public_id: options.publicId,
        folder: options.folder,
        overwrite: options.overwrite ?? true,
        resource_type: "image",
        use_filename: true,
        unique_filename: false,
      },
      (error, result) => {
        if (error) reject(new Error(`CLOUDINARY_ERROR: ${error.message}`));
        else if (!result) reject(new Error("CLOUDINARY_ERROR: No result returned"));
        else resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });
}
