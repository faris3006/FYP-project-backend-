const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  createBooking,
  getUserBookings,
  getBookingById,
  uploadReceipt,
} = require('../controllers/bookingController');

const router = express.Router();

const receiptDir = path.join(__dirname, '..', 'uploads', 'receipts');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(receiptDir, { recursive: true });
    cb(null, receiptDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG, and PDF files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

router.post('/', createBooking);
router.get('/', getUserBookings);
router.get('/:id', getBookingById);
router.post('/:id/receipt', upload.single('receipt'), uploadReceipt);

// Multer/file validation errors bubble here
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.includes('Only')) {
    return res.status(400).json({ message: err.message });
  }
  return next(err);
});

module.exports = router;

