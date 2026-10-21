// services/projectThumbnailService.ts
/**
 * Service for handling project thumbnail operations
 * Follows Single Responsibility Principle - handles only thumbnail-related logic
 */

interface ThumbnailOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export class ProjectThumbnailService {
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  private static readonly DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
    maxWidth: 400,
    maxHeight: 300,
    quality: 0.8,
  };

  /**
   * Process and validate an uploaded image file
   */
  static async processImageFile(
    file: File,
    options: ThumbnailOptions = {},
  ): Promise<string> {
    const config: Required<ThumbnailOptions> = {
      ...this.DEFAULT_OPTIONS,
      ...options,
    } as Required<ThumbnailOptions>;

    // Validate file
    this.validateFile(file);

    // Resize if needed
    const resizedImage = await this.resizeImage(file, config);

    return resizedImage;
  }

  /**
   * Validate file type and size
   */
  private static validateFile(file: File): void {
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      throw new Error(
        `Invalid file type. Allowed types: ${this.ALLOWED_TYPES.join(", ")}`,
      );
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }

  /**
   * Resize image to fit within max dimensions while maintaining aspect ratio
   */
  private static async resizeImage(
    file: File,
    options: Required<ThumbnailOptions>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          // Calculate new dimensions
          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            options.maxWidth,
            options.maxHeight,
          );

          canvas.width = width;
          canvas.height = height;

          // Draw resized image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to base64
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to create blob"));
                return;
              }

              const reader = new FileReader();
              reader.onloadend = () => {
                resolve(reader.result as string);
              };
              reader.readAsDataURL(blob);
            },
            "image/jpeg",
            options.quality,
          );
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Calculate dimensions maintaining aspect ratio
   */
  private static calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number,
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * Remove thumbnail data (for cleanup)
   */
  static removeThumbnail(): null {
    return null;
  }
}
