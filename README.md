# Tani Siaga

Tani Siaga adalah aplikasi web untuk mengelola lahan dan kelompok tani, melihat informasi pertanian, serta menghubungkan produk petani dengan pembeli. Proyek terdiri dari frontend SvelteKit dan backend NestJS dengan PostgreSQL.

> **PENTING UNTUK JURI DAN PANITIA — KONFIGURASI DEMO**
>
> Sebelum menjalankan aplikasi, minta tautan Google Drive tim **Nepam Hade Pisan** kepada panitia. File `env.txt` di dalamnya berisi konfigurasi yang diperlukan untuk mengisi `backend\.env` dan `frontend\.env`. Salin nilainya ke file lokal masing-masing setelah menyalin template `.env.example`—jangan unggah atau commit file konfigurasi tersebut ke repository.

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

Untuk menjalankan versi demonstrasi Tani Siaga, lengkapi `backend\.env` menggunakan konfigurasi backend pada file `env.txt` di Google Drive tim **Nepam Hade Pisan**. Tautan Google Drive dapat diminta kepada panitia. Salin nilai ke variabel yang sesuai pada template; jangan mengganti nama variabel. Jika tidak memiliki akses atau suatu variabel tidak tersedia, hubungi panitia sebelum mengubah konfigurasi.

Pasang dependensi backend:

```cmd
cd /d backend
npm install
```

Jalankan backend di **CMD pertama**:

```cmd
npm run start:dev
```

Backend berjalan di `http://localhost:3000`; dokumentasi API Swagger tersedia di `http://localhost:3000/api`. Skema tabel disinkronkan otomatis oleh TypeORM saat backend berjalan.

### 3. Konfigurasikan dan jalankan frontend

Buka **CMD kedua** pada folder proyek `Tani Siaga`, lalu salin template konfigurasi frontend:

```cmd
copy frontend\.env.example frontend\.env
```

Lengkapi `frontend\.env` menggunakan bagian konfigurasi frontend pada file `env.txt` di Google Drive tim **Nepam Hade Pisan**. Minta tautan Google Drive kepada panitia. File tersebut menyediakan konfigurasi untuk layanan yang digunakan proyek, termasuk Firebase. Salin nilai ke variabel yang sesuai di template frontend.

Pasang dependensi frontend dan jalankan server:

```cmd
cd /d frontend
npm install
npm run dev
```

Buka URL yang ditampilkan Vite, biasanya `http://localhost:5173`.

### 4. Menjalankan tunnel untuk webhook pembayaran (opsional)

Tunnel hanya diperlukan jika ingin menguji notifikasi/webhook pembayaran Midtrans yang harus mengakses backend dari internet. Untuk penggunaan lokal biasa, tahap ini boleh dilewati.

1. Pastikan backend berjalan di CMD pertama.
2. Jika belum, pasang dan autentikasi ngrok menggunakan token dari akun ngrok:

   ```cmd
   npm install -g ngrok
   ngrok config add-authtoken TOKEN_NGROK_MILIKMU
   ```

3. Buka **CMD ketiga** pada folder proyek, lalu jalankan script tunnel dari folder backend:

   ```cmd
   cd /d backend
   npm run tunnel
   ```

4. Catat alamat HTTPS `Forwarding` yang ditampilkan ngrok, misalnya `https://contoh.ngrok-free.app`.
5. Di Midtrans Sandbox, atur Payment Notification URL menjadi:

   ```text
   https://contoh.ngrok-free.app/orders/webhook
   ```

   Ganti domain contoh dengan alamat HTTPS milikmu. Untuk melihat pesan startup backend yang berkaitan dengan tunnel, atur `PUBLIC_TUNNEL_URL=https://contoh.ngrok-free.app` di `backend\.env`, lalu mulai ulang backend. Nilai ini opsional.

Gunakan kredensial Midtrans Sandbox saat pengujian. Jangan gunakan mode produksi untuk demonstrasi atau pengujian juri.

## Integrasi opsional

Fitur berikut memerlukan akun atau kredensial penyedia masing-masing:

- **Gemini AI:** `GEMINI_API_KEY`
- **Data BPS:** `BPS_API_KEY`
- **Pembayaran:** `MIDTRANS_CLIENT_KEY` dan `MIDTRANS_SERVER_KEY`; gunakan kredensial Sandbox dan set `MIDTRANS_IS_PRODUCTION=false`.
- **Unggah gambar:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, dan `CLOUDINARY_API_SECRET`
- **Notifikasi push backend:** berkas kredensial Firebase Admin dan `FIREBASE_CREDENTIAL_PATH`. Tanpa kredensial ini, backend tetap berjalan tetapi push notification dinonaktifkan.
- **Webhook Midtrans publik:** URL tunnel ngrok pada `PUBLIC_TUNNEL_URL`, hanya diperlukan untuk menguji webhook.

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

## Keamanan konfigurasi

Konfigurasi layanan untuk demonstrasi disimpan terpisah dari repository pada file `env.txt` di Google Drive tim **Nepam Hade Pisan**. Juri dapat meminta tautannya kepada panitia, lalu mengisi file `.env` lokal backend dan frontend berdasarkan bagian yang sesuai. Akses ke file tersebut dibatasi melalui Google Drive agar kredensial tidak dipublikasikan bersama source code.

Jangan mengunggah atau meng-commit `env.txt` maupun file `.env`, dan jangan membagikan isinya di README, source code, screenshot, issue, atau kanal publik. File `.env` lokal diabaikan oleh Git; file `.env.example` hanya template nama variabel. Jika menyalin konfigurasi ke komputer sendiri, simpan hanya pada file `.env` lokal yang tepat dan jangan mengubah template `.env.example`.

Password PostgreSQL sebelumnya pernah tertulis langsung di source code. Walaupun sudah dipindahkan ke `.env`, riwayat Git masih dapat menyimpan nilai lama. Ganti/rotasi password database yang terdampak sebelum membagikan atau memublikasikan repository. Terapkan prinsip yang sama pada kredensial lain yang pernah masuk ke riwayat commit.
