// lib/locationServices.ts
//
// Content configuration for location-based service pages.
// Used by the dynamic route: app/[locale]/services/website-[location]/page.tsx

export type LocationSlug =
    | "website-banjarnegara"
    | "website-karawang"
    | "website-purwokerto"
    | "website-wonosobo";

export type LocationData = {
    slug: LocationSlug;
    city: string; // display name
    region: string; // province / region label
    en: LocationContent;
    id: LocationContent;
};

export type LocationContent = {
    metaTitle: string;
    metaDescription: string;
    heroTitle: string;
    heroSubtitle: string;
    introTitle: string;
    introText: string;
    whyTitle: string;
    whyText: string;
    whyReasons: string[];
    clientSegments: string[]; // types of local clients
    ctaTitle: string;
    ctaDescription: string;
};

// ── Location data ────────────────────────────────────────────

export const LOCATION_DATA: Record<LocationSlug, LocationData> = {
    "website-banjarnegara": {
        slug: "website-banjarnegara",
        city: "Banjarnegara",
        region: "Central Java",

        en: {
            metaTitle:
                "Website Development Services Banjarnegara | Web Developer Banjarnegara",
            metaDescription:
                "Professional website development services in Banjarnegara for local businesses, tourism operators, and UMKM. Fast, modern, SEO-friendly websites built by a local web developer.",

            heroTitle: "Website Development Services in Banjarnegara",
            heroSubtitle:
                "Professional website development in Banjarnegara for local businesses, tourism operators, and organizations that want to build a strong online presence.",

            introTitle: "Local Web Developer in Banjarnegara",
            introText:
                "As a web developer based in Banjarnegara, I provide professional website development services for UMKM, tourism businesses, and local organizations that want to build a credible online presence. A well-built website helps customers discover your business on Google, learn about your services, and contact you easily. Whether you run a guesthouse near Dieng, a local shop, or a growing small business, having a modern website helps you compete in today's digital market.",

            whyTitle: "Why Businesses in Banjarnegara Need a Website",
            whyText:
                "Banjarnegara's economy continues to grow, supported by tourism in Dieng, local UMKM, and agriculture. Many customers now search for products and services online before visiting a business. A professional website helps businesses in Banjarnegara appear in search results, build trust with potential customers, and reach audiences beyond traditional word-of-mouth marketing.",

            whyReasons: [
                "Tourists searching online for accommodation, guides, or local products near Dieng and Banjarnegara",
                "UMKM promoting products through online catalogs or simple ordering pages",
                "Local services building credibility with a professional company website",
                "Organizations and schools sharing information with wider audiences",
            ],

            clientSegments: [
                "Tourism businesses and hospitality services",
                "UMKM and local product sellers in Banjarnegara",
                "Agribusiness and farming cooperatives",
                "Schools, communities, and local organizations",
            ],

            ctaTitle: "Need a Website in Banjarnegara?",
            ctaDescription:
                "If you are looking for website development services in Banjarnegara, feel free to reach out with a short description of your project. Available for local meetings in Banjarnegara or remote collaboration.",
        },

        id: {
            metaTitle:
                "Jasa Pembuatan Website Banjarnegara | Web Developer Banjarnegara",
            metaDescription:
                "Jasa pembuatan website di Banjarnegara untuk UMKM, bisnis lokal, dan pariwisata. Website profesional, cepat, SEO friendly, dan mudah dikelola.",

            heroTitle: "Jasa Pembuatan Website di Banjarnegara",
            heroSubtitle:
                "Menyediakan jasa pembuatan website di Banjarnegara untuk UMKM, bisnis lokal, dan organisasi yang ingin memiliki website profesional dan mudah ditemukan di Google.",

            introTitle: "Web Developer Lokal di Banjarnegara",
            introText:
                "Sebagai web developer yang berbasis di Banjarnegara, saya menyediakan jasa pembuatan website untuk UMKM, bisnis lokal, dan organisasi yang ingin membangun kehadiran online yang profesional. Website yang dibuat tidak hanya menarik secara visual, tetapi juga cepat, responsif, dan SEO friendly sehingga mudah ditemukan oleh pelanggan melalui Google. Baik Anda mengelola penginapan wisata di sekitar Dieng, usaha kecil, maupun organisasi komunitas, website yang profesional dapat membantu meningkatkan kepercayaan dan memperluas jangkauan bisnis Anda.",

            whyTitle: "Mengapa Bisnis di Banjarnegara Membutuhkan Website",
            whyText:
                "Ekonomi Banjarnegara terus berkembang, terutama di sektor pariwisata Dieng, UMKM, dan agribisnis. Banyak pelanggan kini mencari produk atau layanan melalui internet sebelum memutuskan untuk membeli atau mengunjungi suatu tempat. Dengan memiliki website profesional, bisnis di Banjarnegara dapat lebih mudah ditemukan di Google, terlihat lebih terpercaya, dan menjangkau pelanggan di luar area lokal.",

            whyReasons: [
                "Wisatawan yang mencari penginapan, pemandu wisata, atau produk lokal di Banjarnegara",
                "UMKM yang ingin mempromosikan produk melalui katalog online",
                "Bisnis lokal yang ingin memiliki website company profile yang profesional",
                "Organisasi komunitas dan sekolah yang perlu berbagi informasi secara online",
            ],

            clientSegments: [
                "Usaha pariwisata dan penginapan di Banjarnegara",
                "UMKM dan penjual produk lokal",
                "Agribisnis dan koperasi pertanian",
                "Organisasi komunitas dan lembaga pendidikan",
            ],

            ctaTitle: "Butuh Website di Banjarnegara?",
            ctaDescription:
                "Jika Anda membutuhkan jasa pembuatan website di Banjarnegara, silakan hubungi dengan deskripsi singkat mengenai kebutuhan proyek Anda. Tersedia untuk pertemuan langsung di Banjarnegara maupun kolaborasi jarak jauh.",
        },
    },

    "website-karawang": {
        slug: "website-karawang",
        city: "Karawang",
        region: "West Java",

        en: {
            metaTitle:
                "Website Development Services Karawang | Web Developer Karawang",
            metaDescription:
                "Professional website development services in Karawang for manufacturing companies, industrial businesses, and local enterprises. Modern, fast, and SEO-friendly websites built by a professional web developer.",

            heroTitle: "Website Development Services in Karawang",
            heroSubtitle:
                "Professional website development in Karawang for manufacturing companies, industrial services, and local businesses that want a strong digital presence.",

            introTitle: "Web Developer Serving Businesses in Karawang",
            introText:
                "Karawang is one of Indonesia's largest industrial regions, home to manufacturing companies, suppliers, logistics providers, and growing local businesses. As a web developer providing website development services in Karawang, I help companies build professional websites that clearly present their services, capabilities, and company profile. A well-designed website helps potential partners, clients, and job applicants find your company through Google and understand your business quickly.",

            whyTitle: "Why Businesses in Karawang Need a Professional Website",
            whyText:
                "In a major industrial city like Karawang, many business relationships begin with online research. Companies often search online before contacting suppliers, logistics partners, or service providers. A professional website helps businesses in Karawang appear in search results, build credibility, and present their services clearly to potential clients.",

            whyReasons: [
                "Manufacturing companies presenting their capabilities to B2B partners",
                "Industrial suppliers showcasing products and services to procurement teams",
                "Logistics and distribution companies building trust with new clients",
                "Local Karawang businesses expanding their reach to national customers",
            ],

            clientSegments: [
                "Manufacturing and industrial companies",
                "Logistics and supply chain businesses",
                "Supplier and vendor companies",
                "Local commercial businesses in Karawang",
            ],

            ctaTitle: "Need a Website for Your Business in Karawang?",
            ctaDescription:
                "If you are looking for website development services in Karawang, feel free to share a short description of your project. Available for remote collaboration and professional website development for companies in Karawang.",
        },

        id: {
            metaTitle:
                "Jasa Pembuatan Website Karawang | Web Developer Karawang",
            metaDescription:
                "Jasa pembuatan website di Karawang untuk perusahaan manufaktur, industri, dan bisnis lokal. Website profesional, cepat, SEO friendly, dan mudah dikelola.",

            heroTitle: "Jasa Pembuatan Website di Karawang",
            heroSubtitle:
                "Menyediakan jasa pembuatan website di Karawang untuk perusahaan industri, manufaktur, dan bisnis lokal yang ingin memiliki website profesional.",

            introTitle: "Web Developer untuk Bisnis di Karawang",
            introText:
                "Karawang merupakan salah satu kawasan industri terbesar di Indonesia dengan banyak perusahaan manufaktur, supplier, dan penyedia layanan logistik. Sebagai web developer yang menyediakan jasa pembuatan website di Karawang, saya membantu perusahaan membangun website profesional yang dapat menampilkan profil perusahaan, layanan, dan kapabilitas bisnis secara jelas. Website yang modern dan SEO friendly membantu calon klien, mitra bisnis, maupun kandidat karyawan menemukan perusahaan Anda melalui Google.",

            whyTitle: "Mengapa Bisnis di Karawang Membutuhkan Website",
            whyText:
                "Di kota industri seperti Karawang, banyak kerja sama bisnis dimulai dari pencarian online. Perusahaan sering mencari supplier, vendor, atau mitra logistik melalui internet sebelum melakukan kontak langsung. Dengan memiliki website profesional, bisnis di Karawang dapat lebih mudah ditemukan di Google, terlihat lebih terpercaya, dan menjelaskan layanan mereka secara jelas kepada calon klien.",

            whyReasons: [
                "Perusahaan manufaktur yang ingin menampilkan profil dan kapabilitas bisnis",
                "Supplier industri yang ingin mempromosikan produk kepada tim procurement",
                "Perusahaan logistik dan distribusi yang membangun kredibilitas digital",
                "Bisnis lokal di Karawang yang ingin menjangkau klien nasional",
            ],

            clientSegments: [
                "Perusahaan manufaktur dan industri",
                "Perusahaan logistik dan supply chain",
                "Supplier dan vendor industri",
                "Bisnis komersial lokal di Karawang",
            ],

            ctaTitle: "Butuh Website untuk Bisnis di Karawang?",
            ctaDescription:
                "Jika Anda membutuhkan jasa pembuatan website di Karawang, silakan kirimkan deskripsi singkat mengenai proyek atau kebutuhan bisnis Anda. Website dapat dikembangkan secara profesional dengan kolaborasi jarak jauh.",
        },
    },

    "website-purwokerto": {
        slug: "website-purwokerto",
        city: "Purwokerto",
        region: "Central Java",
        en: {
            metaTitle:
                "Website Development Services in Purwokerto | Randy Rafael",
            metaDescription:
                "Professional website development services in Purwokerto for education institutions, local SMEs, cafes, and businesses. Modern and easy to maintain.",
            heroTitle: "Website Development in Purwokerto",
            heroSubtitle:
                "Helping businesses, educators, and entrepreneurs in Purwokerto build a clean and functional web presence.",
            introTitle: "Building for Purwokerto's Growing Economy",
            introText:
                "Purwokerto is a growing student city with a vibrant SME and culinary scene. Whether you run a cafe, a tutoring center, or a local retail business, a well-designed website helps you stand out and get found online.",
            whyTitle: "Why Purwokerto Businesses Need a Website",
            whyText:
                "With a large student population and increasing digital adoption, Purwokerto consumers search online before they visit. Businesses without a web presence are often invisible to this audience.",
            whyReasons: [
                "Cafes and food businesses reaching students and young professionals",
                "Education institutions and tutoring centers attracting new students",
                "Local SMEs building credibility and expanding their market",
                "Service businesses replacing manual promotion with a searchable online presence",
            ],
            clientSegments: [
                "Cafes, restaurants, and food businesses",
                "Education institutions and tutoring centers",
                "Local retail and SME businesses",
                "Professional service providers",
            ],
            ctaTitle: "Have a Project in Purwokerto?",
            ctaDescription:
                "Reach out with what you need. Available for remote work and occasional in-person meetings in the Purwokerto area.",
        },
        id: {
            metaTitle: "Jasa Pembuatan Website di Purwokerto | Randy Rafael",
            metaDescription:
                "Jasa pembuatan website profesional di Purwokerto untuk lembaga pendidikan, UMKM, kafe, dan bisnis lokal. Modern dan mudah dikelola.",
            heroTitle: "Jasa Pembuatan Website di Purwokerto",
            heroSubtitle:
                "Membantu bisnis, pendidik, dan wirausahawan di Purwokerto membangun kehadiran web yang bersih dan fungsional.",
            introTitle: "Membangun untuk Ekonomi Purwokerto yang Berkembang",
            introText:
                "Purwokerto adalah kota mahasiswa yang berkembang dengan ekosistem UMKM dan kuliner yang semarak. Baik Anda mengelola kafe, lembaga bimbingan belajar, atau usaha ritel lokal, website yang dirancang dengan baik membantu Anda tampil menonjol dan mudah ditemukan secara online.",
            whyTitle: "Mengapa Bisnis di Purwokerto Butuh Website",
            whyText:
                "Dengan populasi mahasiswa yang besar dan adopsi digital yang terus meningkat, konsumen Purwokerto mencari informasi online sebelum berkunjung. Bisnis tanpa kehadiran web sering tidak terlihat oleh audiens ini.",
            whyReasons: [
                "Kafe dan bisnis kuliner yang menjangkau mahasiswa dan profesional muda",
                "Lembaga pendidikan dan bimbel yang menarik siswa baru",
                "UMKM lokal yang membangun kredibilitas dan memperluas pasar",
                "Bisnis jasa yang menggantikan promosi manual dengan kehadiran online yang mudah ditemukan",
            ],
            clientSegments: [
                "Kafe, restoran, dan bisnis kuliner",
                "Lembaga pendidikan dan bimbel",
                "Ritel lokal dan UMKM",
                "Penyedia layanan profesional",
            ],
            ctaTitle: "Punya Proyek di Purwokerto?",
            ctaDescription:
                "Hubungi dengan deskripsi kebutuhan Anda. Tersedia untuk pekerjaan jarak jauh dan pertemuan langsung di area Purwokerto.",
        },
    },

    "website-wonosobo": {
        slug: "website-wonosobo",
        city: "Wonosobo",
        region: "Central Java",

        en: {
            metaTitle:
                "Website Development Services Wonosobo | Web Developer Wonosobo",
            metaDescription:
                "Professional website development services in Wonosobo for tourism businesses, hotels, homestays, and local enterprises near Dieng. Fast, mobile-friendly, and SEO-optimized websites.",

            heroTitle: "Website Development Services in Wonosobo",
            heroSubtitle:
                "Professional website development in Wonosobo for tourism businesses, hotels, and local enterprises that want to attract visitors planning trips to Dieng.",

            introTitle:
                "Web Developer for Tourism and Local Businesses in Wonosobo",
            introText:
                "Wonosobo is widely known as the main gateway to the Dieng Plateau, one of Central Java's most popular tourist destinations. Travelers often search online for hotels, homestays, restaurants, and tour services before visiting the area. As a web developer providing website development services in Wonosobo, I help tourism businesses and local enterprises build professional websites that showcase their services and attract visitors searching on Google.",

            whyTitle: "Why Businesses in Wonosobo Need a Website",
            whyText:
                "Tourists planning a trip to Dieng usually search online weeks or even months before arriving. Businesses that have a professional website are more likely to appear in search results and receive direct inquiries or bookings. A well-designed website helps visitors quickly understand your services, view photos, and contact you easily.",

            whyReasons: [
                "Hotels and homestays receiving direct booking inquiries from travelers",
                "Tour guides and travel services promoting Dieng tour packages online",
                "Local product sellers offering online catalogs for carica, purwaceng, and regional products",
                "Restaurants and cafes attracting tourists searching for dining options",
            ],

            clientSegments: [
                "Hotels, homestays, and guesthouses",
                "Tour guides and travel services",
                "Local product and souvenir businesses",
                "Restaurants, cafes, and culinary businesses",
            ],

            ctaTitle: "Need a Website for Your Business in Wonosobo?",
            ctaDescription:
                "If you are looking for website development services in Wonosobo, feel free to send a short description of your project. Available for remote collaboration and professional website development.",
        },

        id: {
            metaTitle:
                "Jasa Pembuatan Website Wonosobo | Web Developer Wonosobo",
            metaDescription:
                "Jasa pembuatan website di Wonosobo untuk usaha wisata, hotel, homestay, dan bisnis lokal dekat Dieng. Website profesional, cepat, SEO friendly, dan mobile friendly.",

            heroTitle: "Jasa Pembuatan Website di Wonosobo",
            heroSubtitle:
                "Menyediakan jasa pembuatan website di Wonosobo untuk usaha wisata, hotel, homestay, dan bisnis lokal yang ingin menjangkau wisatawan secara online.",

            introTitle: "Web Developer untuk Bisnis Wisata di Wonosobo",
            introText:
                "Wonosobo dikenal sebagai pintu gerbang menuju kawasan wisata Dieng yang populer di Jawa Tengah. Banyak wisatawan mencari hotel, homestay, restoran, dan layanan wisata melalui Google sebelum datang ke daerah ini. Sebagai web developer yang menyediakan jasa pembuatan website di Wonosobo, saya membantu usaha wisata dan bisnis lokal membangun website profesional yang dapat menampilkan layanan, foto, dan informasi penting bagi calon pengunjung.",

            whyTitle: "Mengapa Bisnis di Wonosobo Membutuhkan Website",
            whyText:
                "Sebagian besar wisatawan merencanakan perjalanan ke Dieng dengan mencari informasi secara online. Bisnis yang memiliki website profesional lebih mudah ditemukan di Google, terlihat lebih terpercaya, dan memiliki peluang lebih besar mendapatkan pemesanan langsung dari pengunjung.",

            whyReasons: [
                "Hotel dan homestay yang ingin menerima pemesanan langsung dari wisatawan",
                "Pemandu wisata dan penyedia paket trip Dieng yang ingin menjangkau pelanggan baru",
                "Penjual produk lokal seperti carica, purwaceng, dan oleh-oleh khas Wonosobo",
                "Restoran dan kafe yang ingin menarik wisatawan yang mencari tempat makan",
            ],

            clientSegments: [
                "Hotel, homestay, dan penginapan",
                "Pemandu wisata dan penyedia paket perjalanan",
                "Penjual produk lokal dan oleh-oleh khas Wonosobo",
                "Restoran, kafe, dan bisnis kuliner",
            ],

            ctaTitle: "Butuh Website untuk Bisnis di Wonosobo?",
            ctaDescription:
                "Jika Anda membutuhkan jasa pembuatan website di Wonosobo, silakan kirimkan deskripsi singkat mengenai kebutuhan proyek Anda. Website dapat dikembangkan secara profesional dengan kolaborasi jarak jauh.",
        },
    },
};

export const LOCATION_SLUGS = Object.keys(LOCATION_DATA) as LocationSlug[];

export function getLocationData(slug: string): LocationData | null {
    return LOCATION_DATA[slug as LocationSlug] ?? null;
}
