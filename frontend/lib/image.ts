// Client-side image calibration:
// Max dimension: 1280px, JPEG quality: 0.5-0.8, Target size: < 1MB
export const calibrateImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const MAX_DIM = 1280;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Quality Calibration Loop to target size < 1MB
        let quality = 0.8;
        let dataUrl = "";
        do {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          // Base64 length * 0.75 is the approximate binary byte size
          const approximateSize = dataUrl.length * 0.75;
          if (approximateSize < 1024 * 1024 || quality <= 0.5) {
            break;
          }
          quality -= 0.05;
        } while (quality >= 0.5);

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};
