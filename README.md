# Asisten Tata Kelola Proyek TI

Alat bantu web untuk mahasiswa dan tim proyek TI kecil di Indonesia dalam menyusun dokumen perencanaan proyek (Project Charter, WBS, Risk Register, Estimasi Biaya) dan meninjaunya terhadap framework COBIT 2019.

---

## Fitur Utama

| Fitur | Template Mode | AI Mode |
|---|:---:|:---:|
| Project Charter | ✅ | ✅ |
| WBS 3 Level | ✅ | ✅ |
| Risk Register (≥6 risiko) | ✅ | ✅ |
| Estimasi Biaya (editable) | ✅ | ✅ |
| Tinjauan COBIT 2019 | ✅ | ✅ |
| KPI & Skor Kesesuaian Indikatif | ✅ | ✅ |
| Ekspor CSV per seksi | ✅ | ✅ |
| Cetak / Simpan PDF | ✅ | ✅ |
| Bekerja tanpa internet | ✅ | ❌ |

---

## Cara Menjalankan

### Mode Template (tanpa API, tanpa internet)

Mode ini menggunakan template bawaan per kategori proyek dan **tidak memerlukan server, API key, atau koneksi internet**.

1. Pastikan file berikut ada di direktori yang sama:
   - `index.html`
   - `app.js`
   - `cobit-data.js`

2. Buka `index.html` dengan ekstensi **Live Server** di VS Code, atau server statis apa pun:
   ```
   # Contoh dengan Python
   python -m http.server 8080
   # lalu buka http://localhost:8080
   ```

3. Isi form → klik **Generate Template** → dokumen langsung ditampilkan.

> ⚠️ Membuka `index.html` langsung via `file://` sudah cukup untuk Template Mode karena tidak ada fetch API.

---

### Mode AI (dengan Google Gemini)

Mode ini mengirimkan data form ke backend Express yang memanggil Google Gemini API.

#### Prasyarat

- Node.js ≥ 18
- API key Google Gemini (dapatkan di <https://aistudio.google.com/app/apikey>)

#### Langkah

1. **Install dependensi:**
   ```bash
   npm install
   ```

2. **Buat file `.env`** (salin dari `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Kemudian edit `.env`:
   ```
   GEMINI_API_KEY=API_KEY_KAMU_DI_SINI
   GEMINI_MODEL=gemini-1.5-flash
   PORT=3000
   ```

3. **Jalankan server:**
   ```bash
   npm start
   ```
   Atau, untuk development dengan auto-reload (Node.js ≥ 18):
   ```bash
   npm run dev
   ```

4. Buka browser di **<http://localhost:3000>**

5. Isi form → klik **Generate dengan AI**.

> Jika AI gagal (quota habis, timeout, JSON tidak valid, API key belum diset), aplikasi otomatis beralih ke **Template Mode** dan menampilkan notifikasi kuning di atas form.

---

## Mengisi Data COBIT 2019

File `cobit-data.js` disertakan sebagai **scaffold kosong** karena data COBIT 2019 dilindungi hak cipta ISACA.

Untuk mengaktifkan fitur pemetaan COBIT sepenuhnya:

1. Buka `cobit-data.js`
2. Isi array `COBIT_OBJECTIVES` dengan objective resmi dari publikasi ISACA, contoh format:
   ```js
   { code: "EDM01", name: "Ensured Governance Framework Setting and Maintenance",
     goal: "Analyse and articulate the requirements for the governance of enterprise IT." }
   ```
3. Simpan file — tidak perlu restart server (file dimuat oleh browser sebagai skrip statis, dan oleh server saat boot).

> Kode COBIT yang tidak terdaftar di `cobit-data.js` akan **ditandai merah** di UI jika dikembalikan oleh LLM.

---

## Struktur File

```
.
├── index.html        # Antarmuka pengguna (SPA, Tailwind CDN)
├── app.js            # Logika frontend (template, AI, governance, export)
├── cobit-data.js     # Scaffold data COBIT 2019 (TODO: isi manual)
├── server.js         # Backend Express + callLLM (Google Gemini)
├── package.json
├── .env.example      # Template konfigurasi (tanpa nilai rahasia)
├── .gitignore
└── README.md
```

---

## Keamanan

- API key **hanya** dibaca dari environment variable di server; tidak pernah dikirim ke frontend.
- Backend melakukan validasi input sebelum memanggil LLM.
- Semua output LLM di-render dengan `escHtml()` untuk mencegah XSS.
- File `.env` dikecualikan dari git melalui `.gitignore`.

---

## Catatan Penting

> **Skor Kesesuaian Indikatif** yang ditampilkan aplikasi ini **bukan** hasil audit, bukan penilaian maturitas, dan tidak mewakili posisi kepatuhan resmi terhadap COBIT 2019.
> Gunakan sebagai panduan awal perencanaan saja.

---

## Lisensi

MIT
