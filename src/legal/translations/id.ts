import type { LegalTranslation } from '../documents';

/**
 * Indonesian translation of the privacy policy and terms of both builds, machine-translated from English on 20 Nov 2026
 * and not yet reviewed by a native speaker or a lawyer. The English version prevails.
 */
export const id: LegalTranslation = {
  openSource: {
    privacy: {
      title: 'Kebijakan Privasi',
      intro:
        'Qutai adalah browser web dengan asisten AI. Kami membuatnya agar aktivitas penjelajahan Anda tetap berada ' +
        'di ponsel Anda. Qutai tidak memiliki server sendiri: kami tidak mengumpulkan, menyimpan, atau menjual data ' +
        'Anda.',
      sections: [
        {
          heading: 'Yang tetap berada di ponsel Anda',
          body:
            'Tab, histori, bookmark, halaman tersimpan, download, izin situs, memori asisten (termasuk jawaban Anda ' +
            'atas pertanyaan penyiapan opsional dan formulir alamat), petunjuk khusus Anda, histori tindakan ' +
            'asisten, dan percakapan Anda hanya disimpan di perangkat ini. Kunci API disimpan di penyimpanan ' +
            'terenkripsi ponsel. Tab Samaran tidak menyimpan apa pun di ponsel kecuali file yang Anda unduh dari tab ' +
            'tersebut; percakapannya tidak disimpan.',
        },
        {
          heading: 'Yang keluar dari ponsel Anda, dan kepada siapa',
          body:
            '• Situs web yang Anda kunjungi menerima apa yang dikirim browser mana pun kepada situs tersebut, serta ' +
            'detail yang Anda minta untuk diketikkan asisten ke dalamnya (seperti nama atau alamat Anda dalam ' +
            'formulir).\n• Saat Anda menggunakan asisten, setiap permintaan dikirim dengan kunci API Anda sendiri ke ' +
            'layanan AI yang Anda siapkan: langsung ke Anthropic, OpenAI, atau Google; ke OpenRouter, yang ' +
            'meneruskannya ke penyedia model yang Anda pilih; atau ke server yang kompatibel dengan OpenAI yang ' +
            'alamatnya Anda masukkan. Permintaan berisi pesan Anda, percakapan sejauh ini, konten yang dibutuhkan ' +
            'asisten (teks halaman, screenshot saat asisten melihat halaman, file dan gambar yang Anda lampirkan, ' +
            'hasil skrip yang Anda setujui di halaman, dan saat Anda bertanya tentang cookie, nama, situs, dan ' +
            'setelannya, tetapi tidak pernah nilainya), petunjuk khusus Anda, dan, selama memori aktif, memori Anda ' +
            '(memori tersembunyi, seperti nomor identitas, hanya sebagai label). Acara kalender dan lokasi Anda hanya dikirim jika Anda mengonfirmasinya, setiap kali, ' +
            'kecuali Anda memilih “Jangan tanya lagi” untuk keduanya (Anda dapat membatalkannya di ' +
            'Setelan › Asisten › “Diizinkan tanpa bertanya”); dalam percakapan dengan tab Samaran, ' +
            'keduanya tidak pernah digunakan. Jika penelusuran web aktif, layanan tersebut ' +
            'dapat menjalankan penelusuran untuk Anda. Kebijakan privasi dan ketentuan layanan tersebut berlaku ' +
            'untuk data ini.\n• Jika saran penelusuran aktif, apa yang Anda ketik di kolom alamat dikirim ke mesin ' +
            'telusur Anda (tidak pernah dari tab Samaran).\n• Jika Anda mengetuk “Gunakan lokasi saya” saat ' +
            'penyiapan, perkiraan posisi Anda dikirim ke layanan alamat ponsel (milik Apple di iPhone; di Android ' +
            'biasanya milik Google) untuk menemukan nama tempatnya. Hanya nama tempat yang disimpan.\n• Jika Anda ' +
            'berbicara kepada asisten dan ponsel tidak dapat mengenali bahasa tersebut di perangkat itu sendiri, ' +
            'audionya dikirim ke layanan ucapan ponsel (milik Apple atau Google), hanya setelah Anda menyetujuinya ' +
            'satu kali di Qutai dan tidak pernah dalam percakapan Samaran. Qutai dan layanan AI hanya menerima ' +
            'teksnya.\n• Saat asisten menampilkan pilihan kepada Anda dalam bentuk kartu, gambarnya dimuat dari ' +
            'situs (atau server gambar situs) yang menampilkannya, tanpa cookie Anda, juga untuk pilihan yang tidak ' +
            'Anda buka; dalam percakapan Samaran hanya saat Anda mengetuk “Tampilkan gambar”.\n• Selama “Blokir ' +
            'iklan dan pelacak” aktif, daftar filter yang Anda pilih diunduh dari penerbitnya (seperti EasyList dan ' +
            'AdGuard) dan diperbarui setiap beberapa hari. Permintaan ini tidak berisi apa pun tentang aktivitas ' +
            'penjelajahan Anda.\nTidak ada hal lain yang dikirim: Qutai tidak memiliki analitik, pelacakan, atau ' +
            'iklan.',
        },
        {
          heading: 'Kontak Anda',
          body:
            'Jika Anda mengizinkannya, asisten dapat menemukan orang yang Anda sebutkan (misalnya “telepon Budi”) di ' +
            'kontak ponsel Anda. Qutai hanya mencari nama yang Anda ucapkan sendiri, di ponsel Anda; buku alamat ' +
            'Anda tidak pernah diunggah atau didaftar. Layanan AI hanya menerima nama yang cocok dan jenis nomor ' +
            'atau alamat yang dimiliki masing-masing (seperti “seluler” atau “email kantor”), tidak pernah nomor ' +
            'atau alamat itu sendiri: Anda melihatnya pada tombol atau draf, dan Anda sendiri yang menelepon atau ' +
            'mengirim. Nomor dan alamat dari kontak Anda tidak disimpan bersama percakapan Anda, memori asisten, ' +
            'atau cadangan Anda. Kontak tidak digunakan dalam percakapan dengan tab Samaran. Anda dapat mengubah ' +
            'izin ini di Setelan.',
        },
        {
          heading: 'Kata sandi dan detail pembayaran',
          body:
            'Qutai tidak mengizinkan memori asisten menyimpan kata sandi, nomor kartu, kode keamanan kartu, tanggal ' +
            'kedaluwarsa kartu, kode sekali pakai, atau nomor rekening bank (IBAN). Nomor identitas dan nomor paspor ' +
            'hanya dapat disimpan dalam kategori identitas atau perjalanan; nomor tersebut disembunyikan dari ' +
            'layanan AI, yang hanya melihat sebuah label, dan Qutai sendiri yang mengetikkan nomor itu ke situs ' +
            'setelah Anda mengonfirmasi. Sebelum asisten pertama kali memasukkan detail pribadi tersimpan Anda di ' +
            'suatu situs, Qutai menanyakannya kepada Anda (Anda dapat mengubah ini untuk setiap situs). Anda juga ' +
            'dapat mewajibkan konfirmasi Anda sebelum setiap tindakan, dan memblokir asisten di situs pilihan Anda.',
        },
        {
          heading: 'Kendali Anda',
          body:
            'Anda dapat melihat dan menghapus memori asisten, menghapus histori, cookie, dan data lainnya di ' +
            'Setelan, serta menghapus kunci API Anda kapan saja. Menghapus instalasi Qutai akan menghapus semua yang disimpannya, kecuali file yang Anda ' +
            'simpan di luar Qutai, seperti unduhan di folder Download Android dan gambar yang disimpan ' +
            'ke Foto Anda.',
        },
        {
          heading: 'Anak-anak',
          body: 'Qutai tidak ditujukan untuk anak-anak di bawah usia 13 tahun.',
        },
        {
          heading: 'Perubahan',
          body:
            'Jika kebijakan ini berubah, Qutai menampilkan versi barunya dan meminta Anda menerimanya sebelum Anda ' +
            'melanjutkan. Jika terdapat perbedaan antara terjemahan ini dan versi bahasa Inggris, versi bahasa ' +
            'Inggris yang berlaku.',
        },
      ],
    },
    terms: {
      title: 'Persyaratan Penggunaan',
      intro:
        'Dengan menggunakan Qutai, Anda menyetujui persyaratan ini. Harap baca persyaratan ini bersama dengan ' +
        'Kebijakan Privasi.',
      sections: [
        {
          heading: 'Penyedia AI Anda dan biaya',
          body:
            'Asisten bekerja dengan kunci API Anda sendiri dari Anthropic, OpenAI, Google, atau OpenRouter, atau ' +
            'dengan server yang kompatibel dengan OpenAI yang Anda siapkan. Anda bertanggung jawab atas akun Anda di ' +
            'layanan tersebut, ketentuannya, dan setiap biaya yang ditagihkan ke kunci Anda.',
        },
        {
          heading: 'Asisten bertindak atas nama Anda',
          body:
            'Asisten dapat membaca halaman, mengeklik, mengetik, dan mengisi formulir saat Anda memintanya. AI dapat ' +
            'membuat kesalahan: periksa jawabannya, dan tinjau pembelian, pemesanan, pesan, dan tindakan penting ' +
            'lainnya sebelum diselesaikan. Anda dapat mewajibkan konfirmasi sebelum setiap tindakan di Setelan.',
        },
        {
          heading: 'Penggunaan yang dapat diterima',
          body:
            'Jangan gunakan Qutai untuk melanggar hukum, melanggar ketentuan situs web atau penyedia AI, atau ' +
            'merugikan orang lain, misalnya dengan mengirim spam atau mengumpulkan data orang lain.',
        },
        {
          heading: 'Situs web dan konten',
          body:
            'Situs web dan kontennya adalah milik pemiliknya masing-masing. Qutai tidak bertanggung jawab atas situs ' +
            'web dan konten tersebut.',
        },
        {
          heading: 'Tanpa jaminan',
          body:
            'Qutai disediakan “sebagaimana adanya”, tanpa jaminan. Sejauh diizinkan oleh hukum, kami tidak ' +
            'bertanggung jawab atas kerugian yang timbul dari penggunaannya, termasuk tindakan yang dilakukan oleh ' +
            'asisten.',
        },
        {
          heading: 'Perubahan',
          body:
            'Jika persyaratan ini berubah, Qutai menampilkan versi barunya dan meminta Anda menerimanya sebelum Anda ' +
            'melanjutkan. Jika terdapat perbedaan antara terjemahan ini dan versi bahasa Inggris, versi bahasa ' +
            'Inggris yang berlaku.',
        },
      ],
    },
  },
  pro: {
    privacy: {
      title: 'Kebijakan Privasi',
      intro:
        'Qutai adalah browser web dengan asisten AI. Kami membuatnya agar aktivitas penjelajahan Anda tetap berada ' +
        'di ponsel Anda. Server Qutai sendiri hanya digunakan untuk akun Qutai Anda (masuk, Qutai Credits, pembelian ' +
        'dalam aplikasi, dan cadangan), dan hanya jika Anda memilihnya. Kami tidak menjual data Anda, dan Qutai ' +
        'tidak memiliki analitik, pelacakan, atau iklan.',
      sections: [
        {
          heading: 'Siapa kami',
          body:
            'Qutai dibuat oleh Osman Yuksel (“kami”), yang bertanggung jawab atas data yang dijelaskan dalam ' +
            'kebijakan ini sebagai Pengendali Data Pribadi. Untuk pertanyaan tentang privasi Anda, atau untuk ' +
            'meminta salinan atau penghapusan data yang disimpan server Qutai tentang Anda, kirim email ke ' +
            'osmanyuksel@gmail.com.',
        },
        {
          heading: 'Yang tetap berada di ponsel Anda',
          body:
            'Tab, histori, bookmark, halaman tersimpan, download, izin situs, memori asisten, histori tindakannya, ' +
            'dan percakapan Anda hanya disimpan di perangkat ini, juga saat Anda sudah masuk, kecuali Anda ' +
            'mencadangkannya ke akun Qutai Anda (lihat di bawah). Kunci API dan data masuk Anda disimpan di ' +
            'penyimpanan terenkripsi ponsel. Tab Samaran tidak menyimpan apa pun di ponsel kecuali file yang Anda unduh dari tab ' +
            'tersebut; percakapannya tidak disimpan.',
        },
        {
          heading: 'Yang keluar dari ponsel Anda, dan kepada siapa',
          body:
            '• Situs web yang Anda kunjungi menerima apa yang dikirim browser mana pun kepada situs tersebut, serta ' +
            'detail yang Anda minta untuk diketikkan asisten ke dalamnya (seperti nama atau alamat Anda dalam ' +
            'formulir).\n• Dengan kunci API Anda sendiri, pesan Anda dan konten yang dibutuhkan asisten (teks ' +
            'halaman, screenshot saat asisten melihat halaman, file dan gambar yang Anda lampirkan, hasil skrip yang ' +
            'Anda setujui di halaman, saat Anda bertanya tentang cookie nama, situs, dan setelannya tetapi tidak ' +
            'pernah nilainya, serta memori dan petunjuk khusus Anda) dikirim langsung ke penyedia AI yang Anda pilih ' +
            '(Anthropic, OpenAI, Google, OpenRouter, atau server Anda sendiri). Server Qutai tidak terlibat. Acara kalender dan lokasi Anda hanya dikirim jika Anda mengonfirmasinya, setiap kali, ' +
            'kecuali Anda memilih “Jangan tanya lagi” untuk keduanya (Anda dapat membatalkannya di ' +
            'Setelan › Asisten › “Diizinkan tanpa bertanya”); dalam percakapan dengan tab Samaran, ' +
            'keduanya tidak pernah digunakan.\n• Dengan Qutai ' +
            'Credits, konten yang sama dikirim terlebih dahulu ke server Qutai, yang meneruskannya ke penyedia AI ' +
            '(Anthropic, OpenAI, atau Google) menggunakan akun milik Qutai sendiri dan mengirimkan jawabannya ' +
            'kembali. Server Qutai tidak menyimpan atau mencatat konten ini. Aplikasi bertanya kepada Anda sebelum ' +
            'Anda menggunakan Qutai Credits untuk pertama kalinya.\n• Jika penelusuran web aktif, penyedia AI dapat ' +
            'menjalankan penelusuran untuk Anda. Kebijakan privasi dan ketentuan para penyedia berlaku untuk apa ' +
            'yang mereka terima.\n• Jika saran penelusuran aktif, apa yang Anda ketik di kolom alamat dikirim ke ' +
            'mesin telusur Anda (tidak pernah dari tab Samaran).\n• Jika Anda mengetuk “Gunakan lokasi saya” saat ' +
            'penyiapan, perkiraan posisi Anda dikirim ke layanan alamat ponsel (milik Apple di iPhone; di Android ' +
            'biasanya milik Google) untuk menemukan nama tempatnya. Hanya nama tempat yang disimpan.\n• Jika Anda ' +
            'berbicara kepada asisten dan ponsel tidak dapat mengenali bahasa tersebut di perangkat itu sendiri, ' +
            'audionya dikirim ke layanan ucapan ponsel (milik Apple atau Google), hanya setelah Anda menyetujuinya ' +
            'satu kali di Qutai dan tidak pernah dalam percakapan Samaran. Qutai dan layanan AI hanya menerima ' +
            'teksnya.\n• Saat asisten menampilkan pilihan kepada Anda dalam bentuk kartu, gambarnya dimuat dari ' +
            'situs (atau server gambar situs) yang menampilkannya, tanpa cookie Anda, juga untuk pilihan yang tidak ' +
            'Anda buka; dalam percakapan Samaran hanya saat Anda mengetuk “Tampilkan gambar”.\n• Selama “Blokir ' +
            'iklan dan pelacak” aktif, daftar filter yang Anda pilih diunduh dari penerbitnya (seperti EasyList dan ' +
            'AdGuard) dan diperbarui setiap beberapa hari. Permintaan ini tidak berisi apa pun tentang aktivitas ' +
            'penjelajahan Anda.',
        },
        {
          heading: 'Akun Qutai Anda',
          body:
            'Akun bersifat opsional; Anda hanya memerlukannya untuk Qutai Credits, pembelian dalam aplikasi, dan ' +
            'cadangan di akun Anda. Anda masuk dengan Apple, dengan Google, atau dengan alamat email Anda. Dengan ' +
            'email, kami mengirim pesan berisi kode sekali pakai dan tautan ke alamat yang Anda masukkan, melalui ' +
            'layanan email kami (Mailjet); kode tersebut berlaku selama 10 menit dan hanya di ponsel yang ' +
            'memintanya, dan untuk mencegah penyalahgunaan, server menghitung berapa banyak kode yang dikirim ke ' +
            'setiap alamat dan ponsel. Server Qutai menyimpan: nomor akun; metode masuk yang dimiliki akun (Apple, ' +
            'Google, email) dan alamat email yang menyertainya (dengan Apple, ini dapat berupa alamat relay ' +
            'pribadi); kapan akun dibuat dan terakhir digunakan; perangkat Anda yang sedang masuk (ID perangkat ' +
            'acak, bukan pengenal ponsel Anda); dan kredit Anda: saldo, pembelian dan kredit yang ditambahkan, serta ' +
            'untuk setiap permintaan asisten, model, jumlah token, biayanya, dan waktunya. Server tidak menyimpan ' +
            'pesan, halaman, atau jawaban Anda.',
        },
        {
          heading: 'Cadangan di akun Qutai Anda',
          body:
            'Hanya jika Anda memilihnya (Setelan › Cadangan), server Qutai menyimpan file cadangan Anda: data yang ' +
            'sama dengan cadangan yang Anda ekspor (bookmark, histori, memori asisten, tugas tersimpan, setelan ' +
            'situs, dan preferensi; tab yang terbuka, percakapan, aktivitas, dan kunci AI hanya jika Anda ' +
            'menyertakannya). File tersebut dienkripsi di ponsel Anda dengan kata sandi yang Anda pilih sebelum ' +
            'dikirim; Qutai tidak dapat membacanya dan tidak dapat memulihkan kata sandinya, yang hanya disimpan di ' +
            'ponsel Anda. Untuk setiap cadangan, server juga menyimpan kapan cadangan dibuat, ukurannya, versi ' +
            'aplikasi, dan jenis ponsel (misalnya “iPhone · iOS 26”). Cadangan terbaru disimpan (saat ini 3) dan ' +
            'yang lebih lama dihapus; Anda dapat menghapusnya kapan saja, dan menghapus akun Anda akan menghapus ' +
            'cadangan tersebut.',
        },
        {
          heading: 'Pembelian dalam aplikasi',
          body:
            'Qutai Credits dan apa pun yang dijual dalam aplikasi dibeli melalui App Store atau Google Play; detail ' +
            'pembayaran Anda tetap berada di Apple atau Google dan tidak pernah sampai ke Qutai. Layanan pembayaran ' +
            '(RevenueCat) menerima nomor akun Qutai Anda dan catatan pembelian dari toko agar pembelian dapat ' +
            'dikonfirmasi, ditambahkan ke akun Anda, dan dipulihkan di ponsel lain. Qutai menyimpan catatan setiap ' +
            'pembelian (toko, transaksi, produk, kredit, harga yang dibayar, dan tanggal), yang wajib kami simpan ' +
            'menurut hukum perpajakan, juga setelah akun dihapus, tanpa keterkaitan dengan Anda. Pengembalian dana ' +
            'ditangani oleh Apple atau Google sesuai aturan mereka sendiri.',
        },
        {
          heading: 'Server Qutai dan pihak lain yang memproses data',
          body:
            'Server Qutai berjalan di Cloudflare, yang juga menyimpan cadangan. Seperti server mana pun, server ini ' +
            'melihat alamat IP Anda pada setiap permintaan; server hanya menggunakannya untuk membatasi berapa ' +
            'banyak permintaan yang dapat dibuat, dan log milik Qutai sendiri tidak pernah berisi alamat IP, alamat ' +
            'email, pesan, halaman, atau token masuk Anda (log tersebut berisi ID permintaan, nomor akun Anda, apa ' +
            'yang diminta, berapa lama prosesnya, dan, untuk permintaan asisten, model, token, dan biaya). ' +
            'Perusahaan yang memproses data untuk Qutai, masing-masing berdasarkan ' +
            'kebijakan privasinya sendiri, adalah: Cloudflare (server), Apple dan Google (masuk dan toko aplikasi), ' +
            'Mailjet (email masuk), RevenueCat (pembelian), dan, dengan Qutai Credits, Anthropic, OpenAI, dan Google ' +
            '(AI). Kami tidak membagikan data Anda kepada pihak lain mana pun, kecuali jika diwajibkan oleh hukum ' +
            '(misalnya perintah pengadilan) atau untuk melindungi Qutai dan penggunanya dari penipuan dan ' +
            'penyalahgunaan.',
        },
        {
          heading: 'Berapa lama data disimpan (masa retensi)',
          body:
            'Di ponsel Anda: sampai Anda menghapusnya atau menghapus instalasi Qutai. Di server Qutai: akun Anda, ' +
            'metode masuknya, perangkat, dan histori kredit sampai Anda menghapus akun; cadangan sebagaimana ' +
            'dijelaskan di atas; kode masuk sampai digunakan atau kedaluwarsa; catatan pembelian selama diwajibkan ' +
            'oleh hukum perpajakan, tanpa keterkaitan dengan Anda setelah akun dihapus.',
        },
        {
          heading: 'Kontak Anda',
          body:
            'Jika Anda mengizinkannya, asisten dapat menemukan orang yang Anda sebutkan (misalnya “telepon Budi”) di ' +
            'kontak ponsel Anda. Qutai hanya mencari nama yang Anda ucapkan sendiri, di ponsel Anda; buku alamat ' +
            'Anda tidak pernah diunggah atau didaftar. Layanan AI hanya menerima nama yang cocok dan jenis nomor ' +
            'atau alamat yang dimiliki masing-masing (seperti “seluler” atau “email kantor”), tidak pernah nomor ' +
            'atau alamat itu sendiri: Anda melihatnya pada tombol atau draf, dan Anda sendiri yang menelepon atau ' +
            'mengirim. Nomor dan alamat dari kontak Anda tidak disimpan bersama percakapan Anda, memori asisten, ' +
            'atau cadangan Anda. Kontak tidak digunakan dalam percakapan dengan tab Samaran. Anda dapat mengubah ' +
            'izin ini di Setelan.',
        },
        {
          heading: 'Kata sandi dan detail pembayaran',
          body:
            'Qutai tidak mengizinkan memori asisten menyimpan kata sandi, nomor kartu, kode keamanan kartu, tanggal ' +
            'kedaluwarsa kartu, kode sekali pakai, atau nomor rekening bank (IBAN). Nomor identitas dan nomor paspor ' +
            'hanya dapat disimpan dalam kategori identitas atau perjalanan; nomor tersebut disembunyikan dari ' +
            'layanan AI, yang hanya melihat sebuah label, dan Qutai sendiri yang mengetikkan nomor itu ke situs ' +
            'setelah Anda mengonfirmasi. Sebelum asisten pertama kali memasukkan detail pribadi tersimpan Anda di ' +
            'suatu situs, Qutai menanyakannya kepada Anda (Anda dapat mengubah ini untuk setiap situs). Anda juga ' +
            'dapat mewajibkan konfirmasi Anda sebelum setiap tindakan, dan memblokir asisten di situs pilihan Anda.',
        },
        {
          heading: 'Kendali Anda',
          body:
            'Anda dapat melihat dan menghapus memori asisten, menghapus histori, cookie, dan data lainnya di ' +
            'Setelan, serta menghapus kunci API Anda kapan saja. Anda dapat menghapus cadangan Anda dari server ' +
            'Qutai di Setelan › Cadangan. Anda dapat berhenti menggunakan Qutai Credits, keluar, atau menghapus akun ' +
            'Anda di Setelan › Akun: menghapusnya akan menghapus akun, saldonya, dan historinya dari server Qutai ' +
            '(catatan pembelian tetap ada tanpa keterkaitan dengan Anda, seperti dijelaskan di atas) dan meminta ' +
            'layanan pembayaran untuk menghapus catatannya tentang Anda. Anda juga dapat mengirim email ke ' +
            'osmanyuksel@gmail.com untuk meminta salinan data yang disimpan server Qutai tentang Anda, atau ' +
            'perbaikan atau penghapusannya. Menghapus instalasi Qutai akan menghapus semua yang disimpannya di ponsel, kecuali file ' +
            'yang Anda simpan di luar Qutai, seperti unduhan di folder Download Android dan gambar ' +
            'yang disimpan ke Foto Anda.',
        },
        {
          heading: 'Keamanan',
          body:
            'Koneksi ke server Qutai menggunakan HTTPS. Token masuk disimpan di server hanya dalam bentuk hash dan ' +
            'di ponsel Anda dalam penyimpanan terenkripsinya, dan cadangan dienkripsi di ponsel Anda sebelum dikirim.',
        },
        {
          heading: 'Anak-anak',
          body:
            'Qutai tidak ditujukan untuk anak-anak di bawah usia 13 tahun, dan kami tidak dengan sengaja ' +
            'mengumpulkan data dari mereka. Di beberapa negara, Anda harus berusia lebih tua (misalnya 16 tahun) ' +
            'untuk menyetujui kebijakan ini sendiri; di bawah usia tersebut, orang tua atau wali harus memberikan ' +
            'persetujuan untuk Anda.',
        },
        {
          heading: 'Perubahan',
          body:
            'Jika kebijakan ini berubah, Qutai menampilkan versi barunya dan meminta Anda menerimanya sebelum Anda ' +
            'melanjutkan. Jika terdapat perbedaan antara terjemahan ini dan versi bahasa Inggris, versi bahasa ' +
            'Inggris yang berlaku.',
        },
      ],
    },
    terms: {
      title: 'Persyaratan Penggunaan',
      intro:
        'Dengan menggunakan Qutai, Anda menyetujui persyaratan ini. Harap baca persyaratan ini bersama dengan ' +
        'Kebijakan Privasi.',
      sections: [
        {
          heading: 'Dua cara menggunakan asisten',
          body:
            '• Kunci API Anda sendiri: Anda bertanggung jawab atas akun Anda di penyedia tersebut, ketentuannya, dan ' +
            'setiap biaya yang ditagihkan ke kunci Anda.\n• Qutai Credits: permintaan asisten melewati server Qutai ' +
            'dan dibayar dengan kredit dari akun Qutai Anda. Anda memerlukan akun untuk menggunakannya.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Kredit dibeli dalam aplikasi melalui App Store atau Google Play, dengan harga yang ditampilkan toko, ' +
            'dan ditambahkan ke akun Qutai Anda setelah pembelian dikonfirmasi. Kredit hanya digunakan untuk ' +
            'membayar permintaan asisten di Qutai, dengan harga kredit yang ditampilkan untuk setiap model; biaya ' +
            'setiap jawaban ditampilkan di bawahnya. Setiap permintaan terlebih dahulu menahan biaya maksimum yang ' +
            'mungkin timbul dan mengembalikan bagian yang tidak terpakai. Kredit merupakan milik akun Qutai Anda, ' +
            'dapat digunakan di ponsel mana pun tempat Anda masuk, tidak dapat dipindahtangankan atau ditukar dengan ' +
            'uang, dan tidak dapat dikembalikan dananya kecuali jika diwajibkan oleh hukum atau aturan pengembalian ' +
            'dana toko; pengembalian dana ditangani oleh Apple atau Google. Jika dana suatu pembelian dikembalikan, ' +
            'kreditnya ditarik kembali, yang dapat membuat saldo menjadi negatif sampai Anda mengisinya kembali. ' +
            'Model, harga kredit, dan batas dapat berubah; yang berlaku saat ini ditampilkan di aplikasi sebelum ' +
            'Anda menggunakannya. Qutai Credits dapat dijeda untuk pemeliharaan atau sesekali tidak tersedia.',
        },
        {
          heading: 'Akun Anda',
          body:
            'Jaga keamanan metode masuk Anda (Apple, Google, atau email Anda); apa yang dilakukan dengan akun Anda ' +
            'adalah tanggung jawab Anda. Kami dapat menangguhkan akun yang melanggar persyaratan ini. Jika Anda ' +
            'menghapus akun Anda, kredit yang tersisa akan hilang.',
        },
        {
          heading: 'Asisten bertindak atas nama Anda',
          body:
            'Asisten dapat membaca halaman, mengeklik, mengetik, dan mengisi formulir saat Anda memintanya. AI dapat ' +
            'membuat kesalahan: periksa jawabannya, dan tinjau pembelian, pemesanan, pesan, dan tindakan penting ' +
            'lainnya sebelum diselesaikan. Anda dapat mewajibkan konfirmasi sebelum setiap tindakan di Setelan.',
        },
        {
          heading: 'Penggunaan yang dapat diterima',
          body:
            'Jangan gunakan Qutai atau Qutai Credits untuk melanggar hukum, melanggar ketentuan situs web atau ' +
            'penyedia AI, merugikan orang lain (misalnya dengan mengirim spam atau mengumpulkan data orang lain), ' +
            'atau menyalahgunakan atau membebani server Qutai secara berlebihan.',
        },
        {
          heading: 'Situs web dan konten',
          body:
            'Situs web dan kontennya adalah milik pemiliknya masing-masing. Qutai tidak bertanggung jawab atas situs ' +
            'web dan konten tersebut.',
        },
        {
          heading: 'Tanpa jaminan',
          body:
            'Qutai disediakan “sebagaimana adanya”, tanpa jaminan. Sejauh diizinkan oleh hukum, kami tidak ' +
            'bertanggung jawab atas kerugian yang timbul dari penggunaannya, termasuk tindakan yang dilakukan oleh ' +
            'asisten.',
        },
        {
          heading: 'Perubahan',
          body:
            'Jika persyaratan ini berubah, Qutai menampilkan versi barunya dan meminta Anda menerimanya sebelum Anda ' +
            'melanjutkan. Jika terdapat perbedaan antara terjemahan ini dan versi bahasa Inggris, versi bahasa ' +
            'Inggris yang berlaku.',
        },
      ],
    },
  },
};
