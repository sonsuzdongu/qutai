import type { LegalTranslation } from '../documents';

/**
 * Indonesian translation of the privacy policy and terms of both builds, machine-translated from English on 20 Nov 2026
 * and not yet reviewed by a native speaker or a lawyer. The sections added on 21 Nov 2026 (protective clauses) are
 * machine-translated too and not reviewed. The English version prevails.
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
            'penyiapan, perkiraan posisi Anda dikirim ke layanan alamat ponsel {{ios:(milik Apple)|android:(biasanya milik Google)}} untuk menemukan nama tempatnya. Hanya nama tempat yang disimpan.\n• Jika Anda ' +
            'berbicara kepada asisten dan ponsel tidak dapat mengenali bahasa tersebut di perangkat itu sendiri, ' +
            'audionya dikirim ke layanan ucapan ponsel {{ios:(milik Apple)|android:(biasanya milik Google)}}, hanya setelah Anda menyetujuinya ' +
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
          heading: 'Pemblokiran, gaya halaman, skrip, dan aplikasi',
          body:
            'Pemblokiran iklan, pelacak, dan iklan video terjadi di ponsel Anda: daftar filter diunduh ke ponsel ' +
            '(lihat di atas) dan permintaan setiap halaman dicocokkan dengan daftar tersebut di sana, sehingga ' +
            'tidak ada apa pun tentang halaman yang Anda kunjungi yang sampai ke penerbit daftar. “Sembunyikan ' +
            'banner cookie” hanya menyembunyikan banner; fitur ini tidak pernah menerima atau menolak cookie atas ' +
            'nama Anda. Aturan Anda sendiri, gaya yang disimpan, dan skrip yang disimpan hanya disimpan di ponsel ' +
            'dan, jika Anda membuat cadangan, di file cadangan Anda, dienkripsi dengan kata sandi Anda. Saat ' +
            'asisten menulis gaya atau skrip, layanan AI menerima permintaan Anda dan konten halaman yang ' +
            'dibutuhkannya, seperti pada pertanyaan apa pun, dan hasil skrip yang Anda setujui juga dikirim ke ' +
            'layanan tersebut; Qutai menolak skrip yang menyentuh cookie, dan hasil skrip tidak pernah disimpan di ' +
            'memori asisten, di cadangan, atau di histori tindakan. Aplikasi di dalam Qutai hanya disimpan di ' +
            'ponsel dan, jika Anda menyertakannya, di file cadangan Anda. Saat Anda meminta Qutai membuat atau ' +
            'memperbaiki aplikasi, kode aplikasi dan pesan error-nya dikirim ke layanan AI; apa yang Anda simpan ' +
            'di dalam aplikasi tidak pernah dikirim. Aplikasi tidak dapat mengakses internet atau melihat situs ' +
            'web maupun cookie-nya.',
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
            'simpan di luar Qutai, seperti {{ios:file yang disimpan di app File|android:unduhan di folder Download Android}} dan gambar yang disimpan ' +
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
            'dengan server yang kompatibel dengan OpenAI yang Anda siapkan. Menggunakannya merupakan perjanjian ' +
            'antara Anda dan layanan tersebut: ketentuan, kebijakan privasi, dan harganya berlaku, dan Anda ' +
            'bertanggung jawab atas akun Anda di sana dan setiap biaya yang ditagihkan ke kunci Anda. Qutai bukan ' +
            'pihak dalam perjanjian tersebut dan tidak dapat mengembalikan biaya tersebut.',
        },
        {
          heading: 'Qutai adalah browser',
          body:
            'Qutai menampilkan situs web yang dikelola orang lain. Kami tidak mengendalikan, memeriksa, atau ' +
            'mendukung situs web, kontennya, atau produk dan layanan yang ditawarkannya, dan kami tidak ' +
            'bertanggung jawab atasnya. Situs web dan kontennya adalah milik pemiliknya masing-masing. Ketentuan ' +
            'masing-masing situs web dan hukum berlaku saat Anda menggunakannya, dan Anda bertanggung jawab untuk ' +
            'mematuhinya. Tautan, hasil penelusuran, dan saran, termasuk dari asisten, bukan rekomendasi dari ' +
            'kami.',
        },
        {
          heading: 'Asisten bertindak atas nama Anda',
          body:
            'Asisten dapat membaca halaman, mengeklik, mengetik, mengisi formulir, serta menyiapkan postingan, ' +
            'pesan, dan pesanan saat Anda memintanya. Sebelum asisten memposting atau mengirim teks di suatu ' +
            'situs, Qutai meminta persetujuan Anda. Menyelesaikan pembayaran nonaktif sampai Anda mengaktifkan ' +
            '“Izinkan asisten menyelesaikan pembayaran” di Setelan › Asisten; bahkan setelah itu, setiap ' +
            'pembayaran memerlukan persetujuan Anda di dialog Qutai sendiri, yang menampilkan totalnya. AI dapat ' +
            'membuat kesalahan: periksa apa yang Anda setujui, dan tinjau pembelian, pemesanan, pembayaran, ' +
            'postingan, pesan, penghapusan, perubahan akun, dan tindakan penting lainnya sebelum diselesaikan. ' +
            'Anda bertanggung jawab atas tindakan yang Anda minta atau setujui, seolah-olah Anda sendiri yang ' +
            'melakukannya. Pembelian dan urusan Anda lainnya dengan situs web, penjual, dan orang lain adalah ' +
            'antara Anda dan mereka: Qutai bukan pihak di dalamnya dan tidak pernah menangani pembayaran Anda ' +
            'kepada mereka. Anda dapat mewajibkan konfirmasi sebelum setiap tindakan di Setelan, dan memblokir ' +
            'asisten di situs pilihan Anda.',
        },
        {
          heading: 'Jawaban AI',
          body:
            'Jawaban, ringkasan, terjemahan, dan apa pun yang ditulis AI dapat salah, tidak lengkap, atau usang. ' +
            'Semua itu bukan nasihat profesional, misalnya nasihat medis, hukum, keuangan, atau pajak: untuk ' +
            'hal-hal seperti itu, mintalah pendapat tenaga profesional yang berkualifikasi. Periksa informasi ' +
            'penting sebelum Anda mengandalkannya.',
        },
        {
          heading: 'Pemblokiran iklan dan pelacak',
          body:
            'Memblokir iklan dan pelacak, menyembunyikan banner cookie, dan memblokir iklan video adalah fitur ' +
            'yang Anda pilih: Anda dapat menonaktifkan masing-masing di Setelan › Privasi dan keamanan, dan ' +
            'menonaktifkan pemblokiran untuk satu situs di panel situs tersebut (“Blokir iklan video” nonaktif ' +
            'sampai Anda mengaktifkannya). Pemblokiran hanya berfungsi di halaman yang Anda buka di ponsel Anda; ' +
            'pemblokiran tidak mengubah situs web itu sendiri. Daftar filter dibuat oleh pihak ketiga dengan ' +
            'lisensi mereka sendiri (misalnya EasyList dengan GPLv3 atau CC BY-SA 3.0, dan AdGuard dengan GPLv3); ' +
            'ponsel Anda mengunduhnya dari penerbitnya, dan Setelan menampilkan halaman beranda dan lisensi setiap ' +
            'daftar. Kami tidak menjamin apa yang diblokir atau tidak diblokir: daftar dapat memblokir terlalu ' +
            'banyak atau terlalu sedikit, dan situs dapat rusak, menampilkan lebih sedikit, atau meminta Anda ' +
            'menonaktifkan pemblokiran. Menggunakan pemblokiran di suatu situs atau tidak adalah keputusan Anda, ' +
            'dan ketentuan situs tersebut berlaku untuk kunjungan Anda.',
        },
        {
          heading: 'Gaya halaman dan skrip',
          body:
            'Anda dapat meminta asisten mengubah tampilan halaman (gaya) atau menjalankan skrip di halaman, ' +
            'menyimpannya untuk suatu situs, serta menulis, mengedit, mengimpor, dan mengekspornya sendiri. Skrip ' +
            'nonaktif sampai Anda mengaktifkannya di Setelan › Asisten. Qutai menampilkan setiap gaya dan skrip ' +
            'yang ditulis asisten dan hanya menjalankannya setelah Anda menyetujuinya, dan skrip yang diimpor ' +
            'tetap nonaktif sampai Anda menyetujuinya. Gaya dan skrip hanya berjalan di halaman yang Anda buka, di ' +
            'ponsel Anda. Qutai menolak sebagian kode yang berisiko, tetapi tidak meninjau kode yang Anda tulis, ' +
            'edit, atau impor, dan tidak dapat menjamin apa yang dilakukan kode mana pun: skrip berjalan dengan ' +
            'sesi masuk Anda di situs tersebut, dapat mengubah atau merusak halaman, dan dapat memengaruhi akun ' +
            'Anda di sana. Setujui hanya apa yang Anda pahami dan percayai. Anda bertanggung jawab atas gaya dan ' +
            'skrip yang Anda setujui, simpan, impor, atau bagikan.',
        },
        {
          heading: 'Aplikasi di dalam Qutai',
          body:
            'Aplikasi di dalam Qutai ditulis oleh AI atas permintaan Anda. Aplikasi berjalan terisolasi dari ' +
            'internet dan dari situs web, tetapi tidak diuji atau ditinjau oleh kami dan disediakan tanpa jaminan: ' +
            'aplikasi dapat mengandung kesalahan atau kehilangan data yang disimpan di dalamnya, jadi ekspor atau ' +
            'cadangkan apa pun yang penting. Aplikasi yang Anda impor dari file dapat berasal dari siapa saja dan ' +
            'tidak ditinjau oleh kami; Qutai menunjukkan kepada Anda apa aplikasi yang diimpor itu dan apa yang ' +
            'boleh digunakannya sebelum Anda mengaktifkannya. Anda bertanggung jawab atas aplikasi yang Anda ' +
            'aktifkan dan aplikasi yang Anda bagikan kepada orang lain.',
        },
        {
          heading: 'Unduhan dan pemasangan file',
          body:
            'Anda yang memutuskan apa yang diunduh, dibuka, dan dipasang. Qutai memperingatkan Anda sebelum ' +
            'mengunduh file yang dapat memasang atau menjalankan kode, tetapi tidak memindai file untuk mencari ' +
            'virus atau bahaya lainnya. {{ios:Qutai tidak pernah memasang apa pun sendiri. File yang diunduh dapat|android:Membuka aplikasi yang diunduh (file APK) akan menyerahkannya ke penginstal sistem; Qutai tidak pernah memasang apa pun sendiri. File dan aplikasi dari luar Google Play dapat}} membahayakan ponsel atau data Anda; mengunduh, membuka, dan memasangnya ' +
            'adalah tanggung jawab Anda, demikian pula memastikan bahwa Anda berhak melakukannya.',
        },
        {
          heading: 'Penggunaan yang dapat diterima',
          body:
            'Jangan gunakan Qutai, asisten, gaya, skrip, atau aplikasi untuk:\n' +
            '• melanggar hukum atau hak orang lain, seperti privasi, hak cipta, atau merek dagang mereka;\n' +
            '• melanggar ketentuan situs web atau penyedia AI;\n' +
            '• mengakali kata sandi, kontrol akses, pembatasan konten berbayar, perlindungan salinan (DRM), atau ' +
            'perlindungan teknis lainnya;\n' +
            '• mengumpulkan, melacak, atau memublikasikan data pribadi orang lain secara melanggar hukum;\n' +
            '• mengirim spam, membuat akun atau ulasan palsu, memposting atau bertindak secara massal dan ' +
            'otomatis, atau membebani situs web secara berlebihan;\n' +
            '• menipu atau mencurangi siapa pun, atau menyebarkan malware.',
        },
        {
          heading: 'Tanpa jaminan dan batasan tanggung jawab',
          body:
            'Qutai disediakan “sebagaimana adanya” dan “sebagaimana tersedia”. Kami berupaya membuatnya bermanfaat ' +
            'dan aman, tetapi kami tidak menjanjikan bahwa Qutai akan selalu berfungsi, bebas dari kesalahan, ' +
            'memblokir apa yang Anda harapkan, atau berfungsi dengan setiap situs web, dan kami tidak memberikan ' +
            'jaminan apa pun selain yang diwajibkan oleh hukum. Sejauh diizinkan oleh hukum, kami tidak ' +
            'bertanggung jawab atas kerugian yang disebabkan oleh situs web dan kontennya, oleh orang lain, oleh ' +
            'layanan penyedia AI, oleh daftar filter, oleh gaya, skrip, dan aplikasi yang Anda setujui atau impor, ' +
            'atau oleh tindakan yang Anda minta atau setujui, maupun atas kerugian tidak langsung seperti ' +
            'hilangnya keuntungan. Tidak ada satu pun dalam persyaratan ini yang membatasi tanggung jawab atas ' +
            'kesengajaan atau kelalaian berat, atas kematian atau cedera badan, atau tanggung jawab lain apa pun ' +
            'yang menurut hukum tidak boleh dibatasi atau dikecualikan.',
        },
        {
          heading: 'Hak Anda sebagai konsumen',
          body:
            'Jika Anda menggunakan Qutai sebagai konsumen, Anda tetap memiliki setiap hak yang diberikan kepada ' +
            'konsumen oleh hukum di tempat tinggal Anda dan yang tidak dapat dikesampingkan melalui perjanjian, ' +
            'seperti hak Anda berdasarkan hukum perlindungan konsumen Turki (Undang-Undang No. 6502 tentang ' +
            'Perlindungan Konsumen) serta hukum perlindungan konsumen Uni Eropa dan Kawasan Ekonomi Eropa. Tidak ' +
            'ada satu pun dalam persyaratan ini yang membatasi atau mengecualikan hak-hak tersebut; jika suatu ' +
            'ketentuan bertentangan dengan hak-hak tersebut, hak-hak tersebutlah yang berlaku.',
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
        'Qutai adalah browser web dengan asisten AI. Kami membuatnya agar aktivitas penjelajahan Anda tetap berada di ' +
        'ponsel Anda. Server Qutai sendiri hanya digunakan untuk akun Qutai Anda (masuk, Qutai Credits, pembelian dalam ' +
        'aplikasi, dan cadangan), dan hanya jika Anda memilihnya. Kami tidak menjual data Anda, dan Qutai tidak memiliki ' +
        'pelacakan atau iklan; statistik penggunaan anonim hanya dikirim jika Anda mengizinkannya.',
      sections: [
        {
          heading: 'Siapa kami',
          body:
            'Qutai dibuat oleh Osman Yuksel (“kami”), yang bertanggung jawab atas data yang dijelaskan dalam ' +
            'kebijakan ini sebagai Pengendali Data Pribadi. Untuk pertanyaan tentang privasi Anda, atau untuk ' +
            'meminta salinan atau penghapusan data yang disimpan server Qutai tentang Anda, kirim email ke ' +
            'qutai@sonsuzdongu.com.',
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
            'penyiapan, perkiraan posisi Anda dikirim ke layanan alamat ponsel {{ios:(milik Apple)|android:(biasanya milik Google)}} untuk menemukan nama tempatnya. Hanya nama tempat yang disimpan.\n• Jika Anda ' +
            'berbicara kepada asisten dan ponsel tidak dapat mengenali bahasa tersebut di perangkat itu sendiri, ' +
            'audionya dikirim ke layanan ucapan ponsel {{ios:(milik Apple)|android:(biasanya milik Google)}}, hanya setelah Anda menyetujuinya ' +
            'satu kali di Qutai dan tidak pernah dalam percakapan Samaran. Qutai dan layanan AI hanya menerima ' +
            'teksnya.\n• Saat asisten menampilkan pilihan kepada Anda dalam bentuk kartu, gambarnya dimuat dari ' +
            'situs (atau server gambar situs) yang menampilkannya, tanpa cookie Anda, juga untuk pilihan yang tidak ' +
            'Anda buka; dalam percakapan Samaran hanya saat Anda mengetuk “Tampilkan gambar”.\n• Selama “Blokir ' +
            'iklan dan pelacak” aktif, daftar filter yang Anda pilih diunduh dari penerbitnya (seperti EasyList dan ' +
            'AdGuard) dan diperbarui setiap beberapa hari. Permintaan ini tidak berisi apa pun tentang aktivitas ' +
            'penjelajahan Anda.\n• ' +
            'Jika Anda melaporkan jawaban atau aplikasi (⋮ › Laporkan), laporan dikirim ke server Qutai: alasannya, catatan Anda, teks jawaban atau nama dan kode aplikasi hanya jika Anda membiarkan “Sertakan” tercentang, apakah jawaban berasal dari Kredit Qutai atau kunci Anda sendiri, versi aplikasi, sistem ponsel dan bahasa aplikasi, serta akun Anda jika Anda masuk. Laporan disimpan 180 hari dan hanya digunakan untuk menemukan dan memperbaiki jawaban dan aplikasi yang berbahaya.',
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
            'aplikasi, dan jenis ponsel {{ios:(misalnya “iPhone · iOS 26”)|android:(misalnya “Android 16”)}}. Cadangan terbaru disimpan (saat ini 3) dan ' +
            'yang lebih lama dihapus; Anda dapat menghapusnya kapan saja, dan menghapus akun Anda akan menghapus ' +
            'cadangan tersebut.',
        },
        {
          heading: 'Pembelian dalam aplikasi',
          body:
            'Qutai Credits dan apa pun yang dijual dalam aplikasi dibeli melalui {{ios:App Store|android:Google Play}}; detail pembayaran Anda tetap berada di {{ios:Apple|android:Google}} dan tidak pernah sampai ke Qutai. Layanan pembayaran ' +
            '(RevenueCat) menerima nomor akun Qutai Anda dan catatan pembelian dari toko agar pembelian dapat ' +
            'dikonfirmasi, ditambahkan ke akun Anda, dan dipulihkan di ponsel lain. Qutai menyimpan catatan setiap ' +
            'pembelian (toko, transaksi, produk, kredit, harga yang dibayar, dan tanggal), yang wajib kami simpan ' +
            'menurut hukum perpajakan, juga setelah akun dihapus, tanpa keterkaitan dengan Anda. Pengembalian dana ' +
            'ditangani oleh {{ios:Apple|android:Google}} sesuai aturan mereka sendiri.',
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
            'kebijakan privasinya sendiri, adalah: Cloudflare (server), {{ios:Apple (masuk dan App Store), Google (masuk)|android:Google (masuk dan Google Play), Apple (masuk)}}, ' +
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
          heading: 'Statistik penggunaan anonim (hanya jika Anda mengizinkan)',
          body:
            'Qutai menanyakan sekali apakah boleh mengirim statistik penggunaan anonim. Tidak ada yang dikirim kecuali Anda ' +
            'mengetuk Izinkan, dan Anda dapat mengubah jawaban kapan saja di Setelan › Privasi dan keamanan. Jika Anda ' +
            'mengizinkan, aplikasi mengirim beberapa informasi tetap ke server Qutai: fitur yang dipakai, bahwa penyiapan ' +
            'selesai, bahwa tugas asisten selesai atau gagal (hanya dengan jenis kesalahannya, misalnya kesalahan jaringan), ' +
            'dan bahwa layar pembelian kredit dibuka, bersama versi aplikasi, {{ios:bahwa ini iPhone|android:bahwa ini ' +
            'Android|web:jenis ponsel}}, bahasa aplikasi, dan angka acak yang dibuat untuk ini di ponsel Anda. Angka itu ' +
            'tidak terhubung dengan akun, proses masuk, atau pengenal lain apa pun, dan dihapus saat Anda mematikan ' +
            'setelannya; server hanya menyimpan bentuknya yang dipendekkan dan diacak. Tidak ada yang dikirim dari tab atau ' +
            'percakapan mode samaran, dan tidak pernah alamat web, isi halaman, pencarian, apa yang Anda tulis, atau memori ' +
            'asisten. Qutai tidak memakai ID iklan dan tidak melacak Anda di berbagai aplikasi atau situs web. Statistik ' +
            'disimpan di Cloudflare selama tiga bulan.',
        },
        {
          heading: 'Pemeriksaan permintaan dan pencegahan penyalahgunaan',
          body:
            'Untuk melindungi Qutai Credits dari penyalahgunaan, saat Anda masuk dan saat asisten memakai Qutai Credits, ' +
            'aplikasi meminta {{ios:layanan App Attest dari Apple|android:layanan integritas Google Play|web:layanan App ' +
            'Attest dari Apple di iPhone atau layanan integritas Google Play di Android}} untuk memastikan bahwa permintaan ' +
            'berasal dari aplikasi Qutai asli di perangkat sungguhan, lalu mengirim konfirmasi itu ke server Qutai. ' +
            '{{ios:Apple menerima kunci yang dibuat untuk ini di ponsel Anda dan ringkasan permintaan; server Qutai menyimpan ' +
            'bagian publik kunci dan sebuah penghitung tanpa menghubungkannya dengan akun Anda, dan menghapusnya setelah 180 ' +
            'hari tidak dipakai.|android:Google menerima ringkasan permintaan dan memeriksa aplikasi serta perangkat; server ' +
            'Qutai hanya menyimpan hasilnya, bersama sesi masuk Anda, paling lama satu jam.|web:Apple atau Google menerima ' +
            'ringkasan permintaan; server Qutai hanya menyimpan yang diperlukan untuk pemeriksaan, tanpa menghubungkannya ' +
            'dengan akun Anda.}} Pemeriksaan tidak pernah mencakup isi permintaan Anda. Server Qutai juga menghitung per hari ' +
            'berapa banyak permintaan yang ditolak oleh batasnya atau gagal dalam pemeriksaan ini, dan untuk setiap akun ' +
            'seberapa sering hal itu terjadi; hitungan ini disimpan 30 hari. Sebuah akun dapat ditandai untuk ditinjau oleh ' +
            'seseorang di Qutai (misalnya setelah banyak permintaan ditolak atau pengembalian dana untuk kredit yang sudah ' +
            'dipakai); tanda itu sendiri tidak memblokir apa pun dan dihapus bersama akunnya.',
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
          heading: 'Pemblokiran, gaya halaman, skrip, dan aplikasi',
          body:
            'Pemblokiran iklan, pelacak, dan iklan video terjadi di ponsel Anda: daftar filter diunduh ke ponsel ' +
            '(lihat di atas) dan permintaan setiap halaman dicocokkan dengan daftar tersebut di sana, sehingga ' +
            'tidak ada apa pun tentang halaman yang Anda kunjungi yang sampai ke penerbit daftar atau ke Qutai. ' +
            '“Sembunyikan banner cookie” hanya menyembunyikan banner; fitur ini tidak pernah menerima atau menolak ' +
            'cookie atas nama Anda. Aturan Anda sendiri, gaya yang disimpan, dan skrip yang disimpan hanya ' +
            'disimpan di ponsel dan, jika Anda membuat cadangan, di cadangan Anda (file yang Anda ekspor, atau ' +
            'cadangan di akun Qutai Anda), dienkripsi dengan kata sandi Anda. Saat asisten menulis gaya atau ' +
            'skrip, layanan AI menerima permintaan Anda dan konten halaman yang dibutuhkannya, seperti pada ' +
            'pertanyaan apa pun, dan hasil skrip yang Anda setujui juga dikirim ke layanan tersebut; Qutai menolak ' +
            'skrip yang menyentuh cookie, dan hasil skrip tidak pernah disimpan di memori asisten, di cadangan, ' +
            'atau di histori tindakan. Aplikasi di dalam Qutai hanya disimpan di ponsel dan, jika Anda ' +
            'menyertakannya, di cadangan Anda. Saat Anda meminta Qutai membuat atau memperbaiki aplikasi, kode ' +
            'aplikasi dan pesan error-nya dikirim ke layanan AI; apa yang Anda simpan di dalam aplikasi tidak ' +
            'pernah dikirim. Aplikasi tidak dapat mengakses internet atau melihat situs web maupun cookie-nya.',
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
            'qutai@sonsuzdongu.com untuk meminta salinan data yang disimpan server Qutai tentang Anda, atau ' +
            'perbaikan atau penghapusannya. Menghapus instalasi Qutai akan menghapus semua yang disimpannya di ponsel, kecuali file ' +
            'yang Anda simpan di luar Qutai, seperti {{ios:file yang disimpan di app File|android:unduhan di folder Download Android}} dan gambar ' +
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
            '• Kunci API Anda sendiri: menggunakannya merupakan perjanjian antara Anda dan penyedia tersebut. ' +
            'Ketentuan, kebijakan privasi, dan harganya berlaku, dan Anda bertanggung jawab atas akun Anda di sana ' +
            'dan setiap biaya yang ditagihkan ke kunci Anda; Qutai bukan pihak dalam perjanjian tersebut dan tidak ' +
            'dapat mengembalikan biaya tersebut.\n' +
            '• Qutai Credits: permintaan asisten melewati server Qutai dan dibayar dengan kredit dari akun Qutai ' +
            'Anda. Anda memerlukan akun untuk menggunakannya.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Kredit dibeli dalam aplikasi melalui {{ios:App Store|android:Google Play}}, dengan harga yang ditampilkan toko, ' +
            'dan ditambahkan ke akun Qutai Anda setelah pembelian dikonfirmasi. Kredit hanya digunakan untuk ' +
            'membayar permintaan asisten di Qutai, dengan harga kredit yang ditampilkan untuk setiap model; biaya ' +
            'setiap jawaban ditampilkan di bawahnya. Setiap permintaan terlebih dahulu menahan biaya maksimum yang ' +
            'mungkin timbul dan mengembalikan bagian yang tidak terpakai. Kredit merupakan milik akun Qutai Anda, ' +
            'dapat digunakan di ponsel mana pun tempat Anda masuk, tidak dapat dipindahtangankan atau ditukar dengan ' +
            'uang, dan tidak dapat dikembalikan dananya kecuali jika diwajibkan oleh hukum atau aturan pengembalian ' +
            'dana toko; pengembalian dana ditangani oleh {{ios:Apple|android:Google}}. Jika dana suatu pembelian dikembalikan, ' +
            'kreditnya ditarik kembali, yang dapat membuat saldo menjadi negatif sampai Anda mengisinya kembali. ' +
            'Kredit tidak memiliki masa kedaluwarsa. Model, harga kredit, dan batas dapat berubah; yang berlaku saat ini ditampilkan di aplikasi sebelum ' +
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
          heading: 'Qutai adalah browser',
          body:
            'Qutai menampilkan situs web yang dikelola orang lain. Kami tidak mengendalikan, memeriksa, atau ' +
            'mendukung situs web, kontennya, atau produk dan layanan yang ditawarkannya, dan kami tidak ' +
            'bertanggung jawab atasnya. Situs web dan kontennya adalah milik pemiliknya masing-masing. Ketentuan ' +
            'masing-masing situs web dan hukum berlaku saat Anda menggunakannya, dan Anda bertanggung jawab untuk ' +
            'mematuhinya. Tautan, hasil penelusuran, dan saran, termasuk dari asisten, bukan rekomendasi dari ' +
            'kami.',
        },
        {
          heading: 'Asisten bertindak atas nama Anda',
          body:
            'Asisten dapat membaca halaman, mengeklik, mengetik, mengisi formulir, serta menyiapkan postingan, ' +
            'pesan, dan pesanan saat Anda memintanya. Sebelum asisten memposting atau mengirim teks di suatu ' +
            'situs, Qutai meminta persetujuan Anda. Menyelesaikan pembayaran nonaktif sampai Anda mengaktifkan ' +
            '“Izinkan asisten menyelesaikan pembayaran” di Setelan › Asisten; bahkan setelah itu, setiap ' +
            'pembayaran memerlukan persetujuan Anda di dialog Qutai sendiri, yang menampilkan totalnya. AI dapat ' +
            'membuat kesalahan: periksa apa yang Anda setujui, dan tinjau pembelian, pemesanan, pembayaran, ' +
            'postingan, pesan, penghapusan, perubahan akun, dan tindakan penting lainnya sebelum diselesaikan. ' +
            'Anda bertanggung jawab atas tindakan yang Anda minta atau setujui, seolah-olah Anda sendiri yang ' +
            'melakukannya. Pembelian dan urusan Anda lainnya dengan situs web, penjual, dan orang lain adalah ' +
            'antara Anda dan mereka: Qutai bukan pihak di dalamnya dan tidak pernah menangani pembayaran Anda ' +
            'kepada mereka. Anda dapat mewajibkan konfirmasi sebelum setiap tindakan di Setelan, dan memblokir ' +
            'asisten di situs pilihan Anda.',
        },
        {
          heading: 'Jawaban AI',
          body:
            'Jawaban, ringkasan, terjemahan, dan apa pun yang ditulis AI dapat salah, tidak lengkap, atau usang. ' +
            'Semua itu bukan nasihat profesional, misalnya nasihat medis, hukum, keuangan, atau pajak: untuk ' +
            'hal-hal seperti itu, mintalah pendapat tenaga profesional yang berkualifikasi. Periksa informasi ' +
            'penting sebelum Anda mengandalkannya.',
        },
        {
          heading: 'Pemblokiran iklan dan pelacak',
          body:
            'Memblokir iklan dan pelacak, menyembunyikan banner cookie, dan memblokir iklan video adalah fitur ' +
            'yang Anda pilih: Anda dapat menonaktifkan masing-masing di Setelan › Privasi dan keamanan, dan ' +
            'menonaktifkan pemblokiran untuk satu situs di panel situs tersebut (“Blokir iklan video” nonaktif ' +
            'sampai Anda mengaktifkannya). Pemblokiran hanya berfungsi di halaman yang Anda buka di ponsel Anda; ' +
            'pemblokiran tidak mengubah situs web itu sendiri. Daftar filter dibuat oleh pihak ketiga dengan ' +
            'lisensi mereka sendiri (misalnya EasyList dengan GPLv3 atau CC BY-SA 3.0, dan AdGuard dengan GPLv3); ' +
            'ponsel Anda mengunduhnya dari penerbitnya, dan Setelan menampilkan halaman beranda dan lisensi setiap ' +
            'daftar. Kami tidak menjamin apa yang diblokir atau tidak diblokir: daftar dapat memblokir terlalu ' +
            'banyak atau terlalu sedikit, dan situs dapat rusak, menampilkan lebih sedikit, atau meminta Anda ' +
            'menonaktifkan pemblokiran. Menggunakan pemblokiran di suatu situs atau tidak adalah keputusan Anda, ' +
            'dan ketentuan situs tersebut berlaku untuk kunjungan Anda.',
        },
        {
          heading: 'Gaya halaman dan skrip',
          body:
            'Anda dapat meminta asisten mengubah tampilan halaman (gaya) atau menjalankan skrip di halaman, ' +
            'menyimpannya untuk suatu situs, serta menulis, mengedit, mengimpor, dan mengekspornya sendiri. Skrip ' +
            'nonaktif sampai Anda mengaktifkannya di Setelan › Asisten. Qutai menampilkan setiap gaya dan skrip ' +
            'yang ditulis asisten dan hanya menjalankannya setelah Anda menyetujuinya, dan skrip yang diimpor ' +
            'tetap nonaktif sampai Anda menyetujuinya. Gaya dan skrip hanya berjalan di halaman yang Anda buka, di ' +
            'ponsel Anda. Qutai menolak sebagian kode yang berisiko, tetapi tidak meninjau kode yang Anda tulis, ' +
            'edit, atau impor, dan tidak dapat menjamin apa yang dilakukan kode mana pun: skrip berjalan dengan ' +
            'sesi masuk Anda di situs tersebut, dapat mengubah atau merusak halaman, dan dapat memengaruhi akun ' +
            'Anda di sana. Setujui hanya apa yang Anda pahami dan percayai. Anda bertanggung jawab atas gaya dan ' +
            'skrip yang Anda setujui, simpan, impor, atau bagikan.',
        },
        {
          heading: 'Aplikasi di dalam Qutai',
          body:
            'Aplikasi di dalam Qutai ditulis oleh AI atas permintaan Anda. Aplikasi berjalan terisolasi dari ' +
            'internet dan dari situs web, tetapi tidak diuji atau ditinjau oleh kami dan disediakan tanpa jaminan: ' +
            'aplikasi dapat mengandung kesalahan atau kehilangan data yang disimpan di dalamnya, jadi ekspor atau ' +
            'cadangkan apa pun yang penting. Aplikasi yang Anda impor dari file dapat berasal dari siapa saja dan ' +
            'tidak ditinjau oleh kami; Qutai menunjukkan kepada Anda apa aplikasi yang diimpor itu dan apa yang ' +
            'boleh digunakannya sebelum Anda mengaktifkannya. Anda bertanggung jawab atas aplikasi yang Anda ' +
            'aktifkan dan aplikasi yang Anda bagikan kepada orang lain.',
        },
        {
          heading: 'Unduhan dan pemasangan file',
          body:
            'Anda yang memutuskan apa yang diunduh, dibuka, dan dipasang. Qutai memperingatkan Anda sebelum ' +
            'mengunduh file yang dapat memasang atau menjalankan kode, tetapi tidak memindai file untuk mencari ' +
            'virus atau bahaya lainnya. {{ios:Qutai tidak pernah memasang apa pun sendiri. File yang diunduh dapat|android:Membuka aplikasi yang diunduh (file APK) akan menyerahkannya ke penginstal sistem; Qutai tidak pernah memasang apa pun sendiri. File dan aplikasi dari luar Google Play dapat}} membahayakan ponsel atau data Anda; mengunduh, membuka, dan memasangnya ' +
            'adalah tanggung jawab Anda, demikian pula memastikan bahwa Anda berhak melakukannya.',
        },
        {
          heading: 'Penggunaan yang dapat diterima',
          body:
            'Jangan gunakan Qutai, Qutai Credits, asisten, gaya, skrip, atau aplikasi untuk:\n' +
            '• melanggar hukum atau hak orang lain, seperti privasi, hak cipta, atau merek dagang mereka;\n' +
            '• melanggar ketentuan situs web atau penyedia AI;\n' +
            '• mengakali kata sandi, kontrol akses, pembatasan konten berbayar, perlindungan salinan (DRM), atau ' +
            'perlindungan teknis lainnya;\n' +
            '• mengumpulkan, melacak, atau memublikasikan data pribadi orang lain secara melanggar hukum;\n' +
            '• mengirim spam, membuat akun atau ulasan palsu, memposting atau bertindak secara massal dan ' +
            'otomatis, atau membebani situs web secara berlebihan;\n' +
            '• menipu atau mencurangi siapa pun, atau menyebarkan malware;\n' +
            '• menyalahgunakan, menyerang, atau membebani server Qutai secara berlebihan.\n' +
            'Kami dapat menangguhkan akun yang digunakan dengan cara-cara tersebut.',
        },
        {
          heading: 'Tanpa jaminan dan batasan tanggung jawab',
          body:
            'Qutai disediakan “sebagaimana adanya” dan “sebagaimana tersedia”. Kami berupaya membuatnya bermanfaat ' +
            'dan aman, tetapi kami tidak menjanjikan bahwa Qutai akan selalu berfungsi, bebas dari kesalahan, ' +
            'memblokir apa yang Anda harapkan, atau berfungsi dengan setiap situs web, dan kami tidak memberikan ' +
            'jaminan apa pun selain yang diwajibkan oleh hukum. Sejauh diizinkan oleh hukum, kami tidak ' +
            'bertanggung jawab atas kerugian yang disebabkan oleh situs web dan kontennya, oleh orang lain, oleh ' +
            'layanan penyedia AI, oleh daftar filter, oleh gaya, skrip, dan aplikasi yang Anda setujui atau impor, ' +
            'atau oleh tindakan yang Anda minta atau setujui, maupun atas kerugian tidak langsung seperti ' +
            'hilangnya keuntungan. Tidak ada satu pun dalam persyaratan ini yang membatasi tanggung jawab atas ' +
            'kesengajaan atau kelalaian berat, atas kematian atau cedera badan, atau tanggung jawab lain apa pun ' +
            'yang menurut hukum tidak boleh dibatasi atau dikecualikan.',
        },
        {
          heading: 'Hak Anda sebagai konsumen',
          body:
            'Jika Anda menggunakan Qutai sebagai konsumen, Anda tetap memiliki setiap hak yang diberikan kepada ' +
            'konsumen oleh hukum di tempat tinggal Anda dan yang tidak dapat dikesampingkan melalui perjanjian, ' +
            'seperti hak Anda berdasarkan hukum perlindungan konsumen Turki (Undang-Undang No. 6502 tentang ' +
            'Perlindungan Konsumen) serta hukum perlindungan konsumen Uni Eropa dan Kawasan Ekonomi Eropa. Tidak ' +
            'ada satu pun dalam persyaratan ini yang membatasi atau mengecualikan hak-hak tersebut; jika suatu ' +
            'ketentuan bertentangan dengan hak-hak tersebut, hak-hak tersebutlah yang berlaku.',
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
