import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';

export type ImagePurpose = 'product' | 'profile' | 'review' | 'moderation';

export interface UploadedImage {
  url: string;
  path: string;
}

export async function uploadImage(file: File, purpose: ImagePurpose): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authenticatedFetch(
    `${API_BASE_URL}/media/images?purpose=${purpose}`,
    { method: 'POST', credentials: 'include', body: formData },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || 'Gagal mengunggah gambar.',
    );
  }
  return data as UploadedImage;
}

export async function uploadImages(files: File[], purpose: ImagePurpose): Promise<string[]> {
  const uploads = await Promise.all(files.map((file) => uploadImage(file, purpose)));
  return uploads.map((image) => image.url);
}
