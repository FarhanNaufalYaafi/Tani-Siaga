# Tani Siaga

Tani Siaga adalah aplikasi web untuk mengelola lahan dan kelompok tani, melihat informasi pertanian, serta menghubungkan produk petani dengan pembeli. Proyek terdiri dari frontend SvelteKit dan backend NestJS dengan PostgreSQL.

> **PENTING UNTUK JURI DAN PANITIA — KONFIGURASI DEMO**
>
> Sebelum menjalankan aplikasi, minta tautan Google Drive pendaftaran tim **Nepam Hade Pisan** kepada panitia. Di sana tersedia `env.pdf` berisi konfigurasi untuk `backend\.env` dan `frontend\.env`, serta berkas `firebase-service-account.key.json` untuk konfigurasi Firebase backend. Ikuti petunjuk penempatan berkas di bawah. Jangan unggah atau commit berkas konfigurasi maupun kunci Firebase ke repository.
>
> **PEMBAYARAN SANDBOX: gunakan OVO.** Setelah pembayaran selesai, tunggu beberapa detik hingga status pesanan berubah menjadi `settlement`. Metode yang bergantung pada webhook dapat gagal memperbarui status jika URL notifikasi dan ngrok tidak sinkron. **Rincian pembayaran selengkapnya ada di bagian “Pengujian pembayaran Midtrans” di bawah.**

## Persyaratan

- Windows dengan Command Prompt (CMD)
- Node.js 20.19+ atau 22.12+ dan npm
- PostgreSQL 14 atau lebih baru
- Kredensial layanan pihak ketiga sesuai fitur yang ingin dicoba (lihat konfigurasi di bawah)

## Menjalankan secara lokal

Semua contoh perintah di panduan ini dijalankan di **Command Prompt (CMD)**. Buka terminal CMD pada folder proyek `Tani Siaga`.

### 1. Siapkan database

Buat database PostgreSQL bernama `tani_siaga`, atau pilih nama lain dan sesuaikan `DB_DATABASE` pada `backend\.env`. Pastikan PostgreSQL berjalan dan nilai koneksi di file `.env` sesuai dengan instalasimu.

### 2. Konfigurasikan backend

Salin template untuk membuat file konfigurasi lokal. Jalankan dari CMD pada folder proyek:

```cmd
copy backend\.env.example backend\.env
```

Untuk menjalankan versi demonstrasi Tani Siaga, lengkapi `backend\.env` menggunakan konfigurasi backend pada bagian yang sesuai di `env.pdf`. File tersebut tersedia di Google Drive pendaftaran tim **Nepam Hade Pisan**; minta tautannya kepada panitia. Salin nilai ke variabel yang sesuai pada template tanpa mengganti nama variabel. Jika tidak memiliki akses atau suatu variabel tidak tersedia, hubungi panitia sebelum mengubah konfigurasi.

Unduh `firebase-service-account.key.json` dari tautan Google Drive pendaftaran yang sama, lalu letakkan berkas tersebut di folder `backend` dengan nama yang sama. Backend menggunakannya untuk notifikasi push Firebase; tanpa berkas ini, backend tetap berjalan tetapi notifikasi push dinonaktifkan.

Pasang dependensi backend:

```cmd
cd /d backend
npm install
```

Jalankan backend di **CMD pertama**. Untuk mode biasa tanpa watch:

```cmd
npm run dev
```

Gunakan `npm run start:dev` jika ingin watch mode agar backend otomatis dimulai ulang saat file berubah.

Backend berjalan di `http://localhost:3000`; dokumentasi API Swagger tersedia di `http://localhost:3000/api`. Skema tabel disinkronkan otomatis oleh TypeORM saat backend berjalan.

### 3. Konfigurasikan dan jalankan frontend

Buka **CMD kedua** pada folder proyek `Tani Siaga`, lalu salin template konfigurasi frontend:

```cmd
copy frontend\.env.example frontend\.env
```

Lengkapi `frontend\.env` menggunakan bagian konfigurasi frontend pada `env.pdf` di Google Drive pendaftaran tim **Nepam Hade Pisan**. Minta tautannya kepada panitia, lalu salin nilai ke variabel yang sesuai di template frontend. Konfigurasi Firebase Web untuk frontend tercantum terpisah dari berkas kredensial Firebase Admin backend.

Pasang dependensi frontend dan jalankan server:

```cmd
cd /d frontend
npm install
npm run dev
```

Buka URL yang ditampilkan Vite, biasanya `http://localhost:5173`.

### 4. Pengujian pembayaran Midtrans

Gunakan kredensial Midtrans Sandbox saat pengujian. Untuk demonstrasi juri, **gunakan metode OVO** pada halaman pembayaran Sandbox. Setelah menyelesaikan pembayaran OVO, tunggu beberapa detik agar status pesanan diperbarui otomatis menjadi `settlement`.

Metode pembayaran seperti DANA bergantung pada webhook notification agar status transaksi diperbarui. URL webhook di dashboard Midtrans Sandbox dan URL publik ngrok berisiko tidak sinkron, sehingga status pesanan mungkin tidak berubah menjadi `settlement`. Untuk menghindari kendala tersebut, jangan gunakan DANA atau metode lain yang membutuhkan webhook selama demonstrasi. Petunjuk konfigurasi tunnel tidak disertakan karena tidak diperlukan untuk alur uji coba yang disarankan.

## Integrasi opsional

Fitur berikut memerlukan akun atau kredensial penyedia masing-masing:

- **Gemini AI:** `GEMINI_API_KEY`
- **Data BPS:** `BPS_API_KEY`
- **Pembayaran:** `MIDTRANS_CLIENT_KEY` dan `MIDTRANS_SERVER_KEY`; gunakan kredensial Sandbox dan set `MIDTRANS_IS_PRODUCTION=false`.
- **Unggah gambar:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, dan `CLOUDINARY_API_SECRET`
- **Notifikasi push backend:** berkas kredensial Firebase Admin dan `FIREBASE_CREDENTIAL_PATH`. Tanpa kredensial ini, backend tetap berjalan tetapi push notification dinonaktifkan.
- **Webhook Midtrans publik:** diperlukan hanya jika ingin menguji metode pembayaran yang bergantung pada webhook; konfigurasi webhook tidak dibutuhkan untuk alur demo OVO yang disarankan.

Tanpa konfigurasi penyedia terkait, fitur integrasi tersebut mungkin tidak tersedia.

## Pemeriksaan

Buka CMD dari folder proyek, lalu jalankan perintah berikut dari folder frontend:

```cmd
cd /d frontend
npm run check
npm run build
```

Untuk pemeriksaan backend, buka CMD lain dari folder proyek:

```cmd
cd /d backend
npm run build
npm test -- --runInBand
```

## Ringkasan cepat menjalankan proyek

Sebelum mulai, pastikan PostgreSQL aktif, `backend\.env` dan `frontend\.env` sudah diisi, dan dependensi kedua bagian proyek sudah dipasang (`npm install` di masing-masing folder). Lalu buka dua jendela CMD:

**CMD pertama — backend**, dari folder proyek:

```cmd
cd /d backend
npm run dev
```

Perintah `npm run dev` menjalankan backend dalam mode biasa. Jika ingin backend otomatis dimulai ulang ketika source berubah, gunakan `npm run start:dev`.

**CMD kedua — frontend**, dari folder proyek:

```cmd
cd /d frontend
npm run dev
```

Buka alamat frontend yang ditampilkan Vite, biasanya `http://localhost:5173`. Untuk pembayaran Sandbox, gunakan OVO dan tunggu beberapa detik agar status pesanan diperbarui menjadi `settlement`. Hindari DANA atau metode lain yang bergantung pada webhook karena URL notification dapat tidak sinkron.

## Keamanan konfigurasi

Konfigurasi layanan untuk demonstrasi disimpan terpisah dari repository: nilai untuk backend dan frontend ada di `env.pdf`, sementara kredensial Firebase Admin tersedia sebagai `firebase-service-account.key.json` pada Google Drive pendaftaran tim **Nepam Hade Pisan**. Juri dapat meminta tautan dan petunjuk akses kepada panitia, lalu mengisi file `.env` lokal dan menempatkan berkas kredensial di folder `backend`.

Jangan mengunggah atau meng-commit `env.pdf`, file `.env`, atau `firebase-service-account.key.json`, dan jangan membagikan isinya di README, source code, screenshot, issue, atau kanal publik. File `.env` dan kunci Firebase lokal diabaikan oleh Git; file `.env.example` hanya template nama variabel. Jika menyalin konfigurasi ke komputer sendiri, simpan hanya pada file `.env` lokal yang tepat dan jangan mengubah template `.env.example`.

Password PostgreSQL sebelumnya pernah tertulis langsung di source code. Walaupun sudah dipindahkan ke `.env`, riwayat Git masih dapat menyimpan nilai lama. Ganti/rotasi password database yang terdampak sebelum membagikan atau memublikasikan repository. Terapkan prinsip yang sama pada kredensial lain yang pernah masuk ke riwayat commit.
