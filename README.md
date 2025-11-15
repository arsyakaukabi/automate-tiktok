# Automate TikTok Downloader

Pipeline untuk mengotomatisasi pengunduhan video TikTok, konversi audio, dan persiapan prompt komentar. Aplikasi ini dibangun dengan Node.js + Express serta SQLite (better-sqlite3) dan menjalankan tiga job paralel:

1. **Downloader** – mengambil metadata & video TikTok, menyimpan sebagai `{username}_{id}.mp4`.
2. **Audio Converter** – mengonversi MP4 yang telah terunduh menjadi WAV menggunakan `ffmpeg`.
3. **Transcriber** – mengirim WAV ke layanan STT Speaches.ai, menyimpan transkrip ke database, dan membangun prompt komentar berdasarkan `prompts.yaml`.

Hasil akhir (video, audio, transkrip, prompt) tersimpan pada tabel `urls`, `transcripts`, dan `comments`.

## Prasyarat

- Node.js 20+ (untuk menjalankan lokal atau membangun Image).
- `ffmpeg` tersedia di PATH (lokal maupun container).
- Docker & Docker Compose (opsional, bila ingin menjalankan seluruh stack termasuk Speaches.ai).
- Akses ke layanan Speaches.ai (default URL: `http://localhost:8000` — disediakan pada docker compose).

## Instalasi Lokal

```bash
npm install
# pastikan videos.db tersedia
touch videos.db
# set environment (opsional jika pakai nilai default)
export DOWNLOAD_JOB_INTERVAL_MS=10000
export SPEACHES_BASE_URL=http://localhost:8000
export TRANSCRIPTION_MODEL_ID=guillaumekln/faster-whisper-base
node main.js
```

Endpoint yang tersedia:

- `POST /urls` – payload `{ "urls": ["https://www.tiktok.com/@user/video/..."] }`.
- `POST /download` – payload `{ "url": "..." }` untuk manual trigger.

Job berjalan otomatis sehingga setelah URL dimasukkan, sistem mengunduh, mengonversi audio, men-transcribe, dan menyiapkan prompt.

## Menjalankan dengan Docker Compose

```bash
# buat file DB jika belum ada
touch videos.db
docker compose up --build
```

Compose menyiapkan:

- `app` – layanan utama (port 3000), mounting `video/`, `audio/`, dan `videos.db`.
- `speaches` – image resmi `ghcr.io/speaches-ai/speaches:latest-cpu` (port 8000) dengan volume cache HuggingFace.

Gunakan endpoint yang sama (`POST http://localhost:3000/urls`) untuk memasukkan daftar video.

## Struktur Direktori

- `main.js` – entry point Express + scheduler job.
- `routes/` – definisi endpoint (misal `urlRoutes`).
- `repositories/` – lapisan akses DB (`urlRepository`, `transcriptRepository`, `commentRepository`).
- `services/`
  - `tiktokService` – interaksi TikTok API + download file.
  - `audioService` – konversi MP4 → WAV using `ffmpeg`.
  - `transcriptionService` – integrasi Speaches.ai.
  - `promptService` – builder template `prompts.yaml`.
- `jobs/`
  - `downloadJob`, `audioConversionJob`, `transcriptionJob`.
- `config.js` – konfigurasi direktori, interval job, endpoint STT, dsb.
- `db.js` – inisialisasi SQLite serta DDL.
- `audio/`, `video/`, `videos.db` – hasil generate (ter-ignore oleh `.gitignore`).

## Best Practices

- **Isolasi Layer** – pisahkan controller, service, repository, job, dan konfigurasi (Clean Architecture). Mudah untuk testing dan pengembangan fitur baru.
- **Environment Variables** – simpan konfigurasi sensitif (URL STT, model ID, interval job) di env/compose file agar mudah diubah tanpa menyentuh kode.
- **Idempotent Jobs** – downloader dan converter mengecek flag di DB (`is_downloaded`, `is_converted`, `is_transcripted`) sehingga aman dijalankan berulang atau paralel.
- **Observability** – log tiap langkah penting (download, convert, transcribe). Pertimbangkan menambah alat monitoring/alert jika dipakai produksi.
- **Resilience** – gunakan retry/backoff pada job bila integrasi eksternal sering gagal. Saat ini error hanya dilog + menghentikan loop untuk memudahkan debugging.
- **Storage Management** – audio/video disimpan di disk lokal; monitor kapasitas dan tambahkan pembersihan/archiving jika diperlukan.
- **Security** – jika endpoint dibuka ke publik, tambahkan auth/rate limit. Pastikan input URL divalidasi sebelum diproses.

## Workflow Pengguna

1. Jalankan aplikasi (lokal atau Docker Compose).
2. Kirim daftar URL TikTok via `POST /urls`.
3. Downloader job mengambil video & metadata → `urls`.
4. Audio job konversi MP4 → WAV → `transcripts.wav_path`.
5. Transcription job panggil Speaches.ai → isi `transcripts.transcript_text` dan `comments.prompt_text`.
6. Prompt siap digunakan untuk mengirim komentar melalui integrasi lanjutan (belum termasuk dalam aplikasi ini).

Dengan arsitektur ini, pipeline berjalan otomatis dan modular, memudahkan penambahan job berikutnya seperti summarizer, LLM comment generator, atau scheduler posting.
