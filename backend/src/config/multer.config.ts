/**
 * Multer Configuration
 *
 * Configures file upload middleware for multi-modal image inputs.
 * Uses memory storage to avoid disk I/O.
 */

import multer from 'multer';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// Memory storage - files stored as Buffer in req.file.buffer
const storage = multer.memoryStorage();

// File filter - only accept PNG and JPEG
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only PNG and JPEG are allowed.`));
  }
};

// Multer instance for image uploads
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Only accept one file at a time
  }
});

// Error handler for multer errors
export function handleMulterError(error: any): { status: number; message: string } {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return {
        status: 400,
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
      };
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return {
        status: 400,
        message: 'Only one file can be uploaded at a time.'
      };
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return {
        status: 400,
        message: 'Unexpected file field. Use "image" field for file uploads.'
      };
    }
    return {
      status: 400,
      message: `Upload error: ${error.message}`
    };
  }

  if (error.message.includes('Invalid file type')) {
    return {
      status: 400,
      message: error.message
    };
  }

  return {
    status: 500,
    message: 'An error occurred during file upload.'
  };
}
