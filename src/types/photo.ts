export interface Photo {
  id: number;
  driveFileId: string;
  driveUrl: string;
  cloudinaryPublicId: string | null;
  cloudinaryUrl: string | null;
  filename: string;
  category: string | null;
  description: string | null;
  altText: string | null;
  classification: "informative" | "decorative";
  vineyardName: string | null;
  season: string | null;
  widthPx: number | null;
  heightPx: number | null;
  uploadedToCdn: boolean;
}

export interface PhotoManifest {
  photos: Photo[];
  heroPhotoId: number | null;
  totalAvailable: number;
}

export interface CloudinaryTransform {
  width: number;
  format: "auto";
  quality: "auto";
  additionalParams?: string;
}
